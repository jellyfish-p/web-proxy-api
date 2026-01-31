import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3';
import { projectRegistry } from '../../../utils/project-registry';
import { getTokenizer } from '../../../utils/tokenizer';

export default defineEventHandler(async (event) => {
    const req = event.node.req;
    const authHeader = req.headers['authorization'] || '';

    if (!authHeader.startsWith('Bearer ')) {
        throw createError({ statusCode: 401, statusMessage: "Unauthorized: missing Bearer token." });
    }

    const authToken = authHeader.substring(7).trim();
    const body = await readBody(event);
    const { model, messages, stream } = body;

    if (!model || !messages) {
        throw createError({ statusCode: 400, statusMessage: "Request must include 'model' and 'messages'." });
    }

    // 根据模型名称获取对应的项目处理器
    const handler = projectRegistry.getHandlerByModel(model);

    if (!handler) {
        const availableModels = projectRegistry.getAllModels();
        throw createError({
            statusCode: 503,
            statusMessage: `Model '${model}' is not available. Available models: ${availableModels.join(', ')}`
        });
    }

    try {
        // Initialize tokenizer
        const tokenizer = await getTokenizer();
        
        const result = await handler.handleRequest({
            authToken,
            body
        });

        if (handler.processResponse) {
            return await handler.processResponse({ event, request: body, result });
        }

        const { response: dsResponse, state, session_id, model: responseModel, thinking_enabled, search_enabled } = result;
        const createdTime = Math.floor(Date.now() / 1000);
        const completionId = `${session_id}`;

        // Calculate prompt tokens
        const promptTokens = tokenizer.countMessagesTokens(messages);

        if (stream) {
            setResponseStatus(event, 200);
            event.node.res.setHeader('Content-Type', 'text/event-stream');
            event.node.res.setHeader('Cache-Control', 'no-cache');
            event.node.res.setHeader('Connection', 'keep-alive');

            const reader = dsResponse.body?.getReader();
            if (!reader) throw new Error("No response body");

            const streamResponse = new ReadableStream({
                async start(controller) {
                    let final_text = "";
                    let final_thinking = "";
                    let first_chunk_sent = false;
                    const decoder = new TextDecoder();
                    let buffer = "";

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || "";

                            for (const line of lines) {
                                if (!line.trim()) continue;
                                if (!line.startsWith("data:")) continue;

                                const dataStr = line.substring(5).trim();
                                if (dataStr === "[DONE]") {
                                    break;
                                }

                                try {
                                    const chunk = JSON.parse(dataStr);
                                    if (!chunk.v) continue;

                                    const v_value = chunk.v;
                                    let content = "";
                                    let ptype = "text";

                                    if (chunk.p === "response/thinking_content") ptype = "thinking";
                                    else if (chunk.p === "response/content") ptype = "text";

                                    // Handle status updates
                                    if (Array.isArray(v_value)) {
                                        const finished = v_value.find((i: any) => i.p === "status" && i.v === "FINISHED");
                                        if (finished) {
                                            // Calculate completion tokens
                                            const completionTokens = tokenizer.estimateTokenCount(final_text + final_thinking);
                                            const totalTokens = promptTokens + completionTokens;

                                            controller.enqueue(`data: ${JSON.stringify({
                                                choices: [{ index: 0, finish_reason: "stop" }],
                                                usage: {
                                                    prompt_tokens: promptTokens,
                                                    completion_tokens: completionTokens,
                                                    total_tokens: totalTokens
                                                }
                                            })}\n\n`);
                                            controller.enqueue("data: [DONE]\n\n");
                                            return;
                                        }
                                        continue;
                                    }

                                    if (typeof v_value === "string") {
                                        content = v_value;
                                    }

                                    if (search_enabled && content.startsWith("[citation:")) content = "";

                                    if (ptype === "thinking" && thinking_enabled) final_thinking += content;
                                    else if (ptype === "text") final_text += content;

                                    const deltaObj: any = {};
                                    if (!first_chunk_sent) {
                                        deltaObj.role = "assistant";
                                        first_chunk_sent = true;
                                    }

                                    if (ptype === "thinking" && thinking_enabled) deltaObj.reasoning_content = content;
                                    else if (ptype === "text") deltaObj.content = content;

                                    if (Object.keys(deltaObj).length > 0) {
                                        const outChunk = {
                                            id: completionId,
                                            object: "chat.completion.chunk",
                                            created: createdTime,
                                            model: responseModel,
                                            choices: [{
                                                delta: deltaObj,
                                                index: 0
                                            }]
                                        };
                                        controller.enqueue(`data: ${JSON.stringify(outChunk)}\n\n`);
                                    }

                                } catch (e) {
                                    // ignore parse errors for chunks
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Stream error:", e);
                    } finally {
                        if (handler.releaseResources) {
                            handler.releaseResources(state);
                        }
                        controller.close();
                    }
                }
            });

            return streamResponse;

        } else {
            // Non-stream response
            const responseText = await dsResponse.text();

            let final_text = "";
            let final_thinking = "";

            const lines = responseText.split("\n");
            for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const dataStr = line.substring(5).trim();
                if (dataStr === "[DONE]") break;

                try {
                    const chunk = JSON.parse(dataStr);
                    if (!chunk.v) continue;

                    let ptype = "text";
                    if (chunk.p === "response/thinking_content") ptype = "thinking";

                    const v_value = chunk.v;

                    if (Array.isArray(v_value)) {
                        continue;
                    }

                    if (typeof v_value === "string") {
                        if (search_enabled && v_value.startsWith("[citation:")) continue;

                        if (ptype === "thinking") final_thinking += v_value;
                        else final_text += v_value;
                    }

                } catch (e) { }
            }

            if (handler.releaseResources) {
                handler.releaseResources(state);
            }

            // Calculate token usage
            const completionTokens = tokenizer.estimateTokenCount(final_text + final_thinking);
            const totalTokens = promptTokens + completionTokens;

            return {
                id: completionId,
                object: "chat.completion",
                created: createdTime,
                model: responseModel,
                choices: [{
                    index: 0,
                    message: {
                        role: "assistant",
                        content: final_text,
                        reasoning_content: final_thinking
                    },
                    finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens
                }
            };
        }

    } catch (e: any) {
        console.error(`Error in chat completions: ${e}`);
        throw createError({ statusCode: 500, statusMessage: e.message || "Internal Server Error" });
    }
});

