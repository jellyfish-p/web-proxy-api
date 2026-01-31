import crypto from 'node:crypto';
import { grokRequest, processGrokResponse } from '../../utils/grok/client';

export interface GrokHandlerParams {
    authToken: string;
    body: any;
}

export async function handleGrokRequest(params: GrokHandlerParams) {
    const { body } = params;
    if (!body?.model || !body?.messages) {
        throw new Error("Request must include 'model' and 'messages'.");
    }

    const { response, token, filename, model } = await grokRequest(body);
    return {
        response,
        state: { token, filename },
        session_id: crypto.randomUUID(),
        model
    };
}

export async function handleGrokResponse(result: { response: Response; state: { token: string; filename: string }; model: string }, stream: boolean) {
    return processGrokResponse(result.response, result.state.token, result.model, stream);
}
