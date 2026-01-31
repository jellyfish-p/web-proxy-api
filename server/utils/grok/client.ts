import { getConfigValue } from '../config';
import crypto from 'node:crypto';
import { getDynamicHeaders } from './statsig';
import { getGrokProxy, forceRefreshGrokProxy } from './proxy-pool';
import { GrokModels, GrokTokenTypes, type GrokTokenType } from './models';
import { grokTokenStore, type GrokTokenRecord } from './token-store';
import { grokImageCache, grokVideoCache } from './cache';

const GROK_API_BASE = 'https://grok.com';

const API_ENDPOINT = `${GROK_API_BASE}/rest/app-chat/conversations/new`;
const RATE_LIMIT_API = `${GROK_API_BASE}/rest/rate-limits`;
const UPLOAD_API = `${GROK_API_BASE}/rest/app-chat/upload-file`;
const CREATE_POST_API = `${GROK_API_BASE}/rest/app-chat/create-post`;

const MAX_FAILURES = 3;

export type GrokClientResult = {
    response: Response;
    token: string;
    model: string;
};

export async function getTokenData() {
    return grokTokenStore.ensureLoaded();
}

function extractSso(authToken: string): string | null {
    const match = authToken.match(/sso=([^;]+)/);
    return match ? match[1] || null : null;
}

async function persistTokenData(data: any): Promise<void> {
    await grokTokenStore.setData(data);
}

function selectBestToken(tokens: Record<string, GrokTokenRecord>, field: 'remainingQueries' | 'heavyremainingQueries') {
    const unused: string[] = [];
    const used: Array<[string, number]> = [];

    for (const [key, data] of Object.entries(tokens)) {
        if (data.status === 'expired') continue;
        if ((data.failedCount || 0) >= MAX_FAILURES) continue;

        const remaining = Number(data[field] ?? -1);
        if (remaining === 0) continue;
        if (remaining === -1) {
            unused.push(key);
        } else if (remaining > 0) {
            used.push([key, remaining]);
        }
    }

    if (unused.length > 0) return { token: unused[0], remaining: -1 };
    if (used.length > 0) {
        used.sort((a, b) => b[1] - a[1]);
        const best = used[0];
        if (!best) return { token: null, remaining: null };
        return { token: best[0], remaining: best[1] };
    }

    return { token: null, remaining: null };
}

export async function selectToken(model: string): Promise<{ token: string; tokenType: GrokTokenType }> {
    const data = await getTokenData();
    const field = model === 'grok-4-heavy' ? 'heavyremainingQueries' : 'remainingQueries';

    let selection = selectBestToken(data[GrokTokenTypes.NORMAL], field);
    let tokenType: GrokTokenType = GrokTokenTypes.NORMAL;
    if (!selection.token) {
        selection = selectBestToken(data[GrokTokenTypes.SUPER], field);
        tokenType = GrokTokenTypes.SUPER;
    }

    if (!selection.token) {
        throw new Error(`No available Grok token for model ${model}`);
    }

    return { token: selection.token, tokenType };
}

function buildAuthToken(token: string): string {
    return `sso-rw=${token};sso=${token}`;
}

async function updateLimits(sso: string, model: string, normal?: number, heavy?: number) {
    const data = await getTokenData();
    for (const type of [GrokTokenTypes.NORMAL, GrokTokenTypes.SUPER]) {
        if (data[type][sso]) {
            if (normal !== undefined) data[type][sso].remainingQueries = normal;
            if (heavy !== undefined) data[type][sso].heavyremainingQueries = heavy;
            await persistTokenData(data);
            return;
        }
    }
}

async function recordFailure(authToken: string, status: number, msg: string): Promise<void> {
    const sso = extractSso(authToken);
    if (!sso) return;
    const data = await getTokenData();
    for (const type of [GrokTokenTypes.NORMAL, GrokTokenTypes.SUPER]) {
        const record = data[type][sso];
        if (record) {
            record.failedCount = (record.failedCount || 0) + 1;
            record.lastFailureTime = Date.now();
            record.lastFailureReason = `${status}: ${msg}`;
            if (status >= 400 && status < 500 && record.failedCount >= MAX_FAILURES) {
                record.status = 'expired';
            }
            await persistTokenData(data);
            return;
        }
    }
}

async function resetFailure(authToken: string): Promise<void> {
    const sso = extractSso(authToken);
    if (!sso) return;
    const data = await getTokenData();
    for (const type of [GrokTokenTypes.NORMAL, GrokTokenTypes.SUPER]) {
        const record = data[type][sso];
        if (record && record.failedCount > 0) {
            record.failedCount = 0;
            record.lastFailureTime = null;
            record.lastFailureReason = null;
            await persistTokenData(data);
            return;
        }
    }
}

async function requestRateLimit(authToken: string, model: string) {
    const rateModel = GrokModels.toRateLimit(model);
    const payload = { requestKind: 'DEFAULT', modelName: rateModel };
    const headers = {
        ...getDynamicHeaders('/rest/rate-limits'),
        Cookie: authToken
    };

    const retryCodes = getConfigValue('grok.retry_status_codes', [401, 429]) as number[];
    const maxOuterRetry = 3;
    const max403Retries = 5;

    for (let outer = 0; outer <= maxOuterRetry; outer += 1) {
        let retry403 = 0;
        while (retry403 <= max403Retries) {
            const proxy = await getGrokProxy();
            const fetchOptions: RequestInit & { agent?: any } = {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            };

            if (proxy) {
                const { SocksProxyAgent } = await import('socks-proxy-agent');
                const { HttpsProxyAgent } = await import('https-proxy-agent');
                const { HttpProxyAgent } = await import('http-proxy-agent');
                const lower = proxy.toLowerCase();
                if (lower.startsWith('socks')) {
                    fetchOptions.agent = new SocksProxyAgent(proxy);
                } else if (lower.startsWith('https://')) {
                    fetchOptions.agent = new HttpsProxyAgent(proxy);
                } else if (lower.startsWith('http://')) {
                    fetchOptions.agent = new HttpProxyAgent(proxy);
                }
            }

            const response = await fetch(RATE_LIMIT_API, fetchOptions);
            if (response.status === 403) {
                retry403 += 1;
                if (retry403 <= max403Retries) {
                    await forceRefreshGrokProxy();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                await recordFailure(authToken, 403, 'blocked');
                return;
            }

            if (retryCodes.includes(response.status)) {
                if (outer < maxOuterRetry) {
                    await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                    break;
                }
                await recordFailure(authToken, response.status, 'rate-limit');
                return;
            }

            if (!response.ok) {
                await recordFailure(authToken, response.status, 'rate-limit');
                return;
            }

            const data = await response.json();
            const sso = extractSso(authToken);
            if (sso) {
                if (model === 'grok-4-heavy') {
                    await updateLimits(sso, model, undefined, data.remainingQueries ?? -1);
                } else {
                    await updateLimits(sso, model, data.remainingTokens ?? -1, undefined);
                }
            }
            return;
        }
    }
}

async function uploadImage(image: string, authToken: string): Promise<[string, string]> {
    if (!image) return ['', ''];

    let buffer = '';
    let mime = 'image/jpeg';
    if (image.startsWith('http')) {
        const response = await fetch(image);
        if (!response.ok) return ['', ''];
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) mime = contentType;
        const data = Buffer.from(await response.arrayBuffer());
        buffer = data.toString('base64');
    } else {
        const raw = image.includes(',') ? image.split(',')[1] : image;
        buffer = raw || '';
        const match = image.match(/data:([a-zA-Z0-9/+. -]+);base64,/);
        if (match && match[1]) mime = match[1];
    }

    const fileName = `image.${mime.split('/')[1] || 'jpg'}`;
    const payload = {
        fileName,
        fileMimeType: mime,
        content: buffer
    };

    const headers = {
        ...getDynamicHeaders('/rest/app-chat/upload-file'),
        Cookie: authToken
    };

    const retryCodes = getConfigValue('grok.retry_status_codes', [401, 429]) as number[];
    const maxOuterRetry = 3;
    const max403Retries = 5;

    for (let outer = 0; outer <= maxOuterRetry; outer += 1) {
        let retry403 = 0;
        while (retry403 <= max403Retries) {
            const proxy = await getGrokProxy();
            const fetchOptions: RequestInit & { agent?: any } = {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            };

            if (proxy) {
                const { SocksProxyAgent } = await import('socks-proxy-agent');
                const { HttpsProxyAgent } = await import('https-proxy-agent');
                const { HttpProxyAgent } = await import('http-proxy-agent');
                const lower = proxy.toLowerCase();
                if (lower.startsWith('socks')) {
                    fetchOptions.agent = new SocksProxyAgent(proxy);
                } else if (lower.startsWith('https://')) {
                    fetchOptions.agent = new HttpsProxyAgent(proxy);
                } else if (lower.startsWith('http://')) {
                    fetchOptions.agent = new HttpProxyAgent(proxy);
                }
            }

            const response = await fetch(UPLOAD_API, fetchOptions);
            if (response.status === 403) {
                retry403 += 1;
                if (retry403 <= max403Retries) {
                    await forceRefreshGrokProxy();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                return ['', ''];
            }

            if (retryCodes.includes(response.status)) {
                if (outer < maxOuterRetry) {
                    await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                    break;
                }
                return ['', ''];
            }

            if (!response.ok) return ['', ''];
            const result = await response.json();
            return [result.fileMetadataId || '', result.fileUri || ''];
        }
    }

    return ['', ''];
}

async function createPost(fileId: string, fileUri: string, authToken: string): Promise<string | null> {
    if (!fileId || !fileUri) return null;
    const headers = {
        ...getDynamicHeaders('/rest/app-chat/create-post'),
        Cookie: authToken
    };
    const payload = {
        fileId,
        fileUri
    };

    const response = await fetch(CREATE_POST_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.success ? data?.postId : null;
}

export async function buildPayload(request: any, authToken: string) {
    const model = request.model;
    const info = GrokModels.getModelInfo(model);
    if (!info) throw new Error(`Model ${model} not supported`);

    const [grokModel, mode] = GrokModels.toGrok(model);
    const images: string[] = [];
    const contentParts: string[] = [];

    for (const msg of request.messages || []) {
        const content = msg.content;
        if (Array.isArray(content)) {
            for (const item of content) {
                if (item.type === 'text') contentParts.push(item.text || '');
                if (item.type === 'image_url' && item.image_url?.url) images.push(item.image_url.url);
            }
        } else if (typeof content === 'string') {
            contentParts.push(content);
        }
    }

    const message = contentParts.join('');

    const fileAttachments: string[] = [];
    const imageAttachments: string[] = [];
    const uploadedUris: string[] = [];

    for (const img of images.slice(0, info.isVideoModel ? 1 : images.length)) {
        const [fileId, fileUri] = await uploadImage(img, authToken);
        if (fileId) {
            fileAttachments.push(fileId);
            if (fileUri) uploadedUris.push(fileUri);
        }
    }

    if (info.isVideoModel && uploadedUris.length > 0) {
        const postId = await createPost(fileAttachments[0] || '', uploadedUris[0] || '', authToken);
        const reference = postId ? `https://grok.com/imagine/${postId}` : `https://assets.grok.com/post/${uploadedUris[0]}`;
        return {
            payload: {
                temporary: true,
                modelName: 'grok-3',
                message: `${reference}  ${message} --mode=custom`,
                fileAttachments,
                toolOverrides: { videoGen: true }
            },
            meta: { model, mode, isVideo: true, postId }
        };
    }

    return {
        payload: {
            temporary: getConfigValue('grok.temporary', false),
            modelName: grokModel,
            message,
            fileAttachments,
            imageAttachments,
            disableSearch: false,
            enableImageGeneration: true,
            returnImageBytes: false,
            returnRawGrokInXaiRequest: false,
            enableImageStreaming: true,
            imageGenerationCount: 2,
            forceConcise: false,
            toolOverrides: {},
            enableSideBySide: true,
            sendFinalMetadata: true,
            isReasoning: false,
            webpageUrls: [],
            disableTextFollowUps: true,
            responseMetadata: { requestModelDetails: { modelId: grokModel } },
            disableMemory: false,
            forceSideBySide: false,
            modelMode: mode,
            isAsyncChat: false
        },
        meta: { model, mode, isVideo: false, postId: null }
    };
}

export async function grokRequest(request: any): Promise<GrokClientResult> {
    const model = request.model;
    const { token: rawToken } = await selectToken(model);
    const authToken = buildAuthToken(rawToken);
    const headers = {
        ...getDynamicHeaders('/rest/app-chat/conversations/new'),
        Cookie: authToken
    };

    const { payload } = await buildPayload(request, authToken);
    const retryCodes = getConfigValue('grok.retry_status_codes', [401, 429]) as number[];
    const maxOuterRetry = 3;
    const max403Retries = 5;

    for (let outer = 0; outer <= maxOuterRetry; outer += 1) {
        let retry403 = 0;
        while (retry403 <= max403Retries) {
            const proxy = await getGrokProxy();
            const fetchOptions: RequestInit & { agent?: any } = {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            };

            if (proxy) {
                const { SocksProxyAgent } = await import('socks-proxy-agent');
                const { HttpsProxyAgent } = await import('https-proxy-agent');
                const { HttpProxyAgent } = await import('http-proxy-agent');
                const lower = proxy.toLowerCase();
                if (lower.startsWith('socks')) {
                    fetchOptions.agent = new SocksProxyAgent(proxy);
                } else if (lower.startsWith('https://')) {
                    fetchOptions.agent = new HttpsProxyAgent(proxy);
                } else if (lower.startsWith('http://')) {
                    fetchOptions.agent = new HttpProxyAgent(proxy);
                }
            }

            const response = await fetch(API_ENDPOINT, fetchOptions);

            if (response.status === 403) {
                retry403 += 1;
                if (retry403 <= max403Retries) {
                    await forceRefreshGrokProxy();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                await recordFailure(authToken, 403, 'blocked');
                throw new Error('Grok request blocked (403)');
            }

            if (retryCodes.includes(response.status)) {
                if (outer < maxOuterRetry) {
                    await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                    break;
                }
                await recordFailure(authToken, response.status, 'retryable');
                throw new Error(`Grok request failed: ${response.status}`);
            }

            if (!response.ok) {
                await recordFailure(authToken, response.status, 'http_error');
                throw new Error(`Grok request failed: ${response.status}`);
            }

            await resetFailure(authToken);
            requestRateLimit(authToken, model).catch(() => null);

            return { response, token: authToken, model };
        }
    }

    throw new Error('Grok request failed after retries');
}

export async function processGrokResponse(response: Response, authToken: string, model: string, stream: boolean) {
    if (stream) return streamGrok(response, authToken, model);
    return processGrok(response, authToken, model);
}

function makeChunk(content: string, modelName: string, finishReason: string | null = null) {
    const chunk = {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [
            {
                index: 0,
                delta: content ? { role: 'assistant', content } : {},
                finish_reason: finishReason || undefined
            }
        ]
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
}

async function processGrok(response: Response, authToken: string, model: string) {
    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);
    let content = '';

    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            const grokResp = data?.result?.response;
            if (!grokResp) continue;
            if (grokResp.streamingVideoGenerationResponse?.videoUrl) {
                const videoContent = await buildVideoContent(grokResp.streamingVideoGenerationResponse.videoUrl, authToken);
                content += videoContent;
                break;
            }

            if (grokResp.modelResponse?.generatedImageUrls) {
                content = await appendImages(content, grokResp.modelResponse.generatedImageUrls, authToken);
                break;
            }

            if (grokResp.modelResponse?.message) {
                content += grokResp.modelResponse.message;
            }
        } catch {
            continue;
        }
    }

    return {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content
                },
                finish_reason: 'stop'
            }
        ]
    };
}

async function* streamGrok(response: Response, authToken: string, model: string) {
    const reader = response.body?.getReader();
    if (!reader) {
        yield makeChunk('', model, 'stop');
        yield 'data: [DONE]\n\n';
        return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const filteredTags = (getConfigValue('grok.filtered_tags', 'xaiartifact,xai:tool_usage_card,grok:render') as string)
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    const showThinking = Boolean(getConfigValue('grok.show_thinking', true));

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                const grokResp = data?.result?.response;
                if (!grokResp) continue;

                if (grokResp.streamingVideoGenerationResponse?.videoUrl) {
                    const videoContent = await buildVideoContent(grokResp.streamingVideoGenerationResponse.videoUrl, authToken);
                    yield makeChunk(videoContent, model, 'stop');
                    yield 'data: [DONE]\n\n';
                    return;
                }

                if (grokResp.modelResponse?.generatedImageUrls) {
                    const imageContent = await appendImages('', grokResp.modelResponse.generatedImageUrls, authToken);
                    yield makeChunk(imageContent, model, 'stop');
                    yield 'data: [DONE]\n\n';
                    return;
                }

                let token = grokResp.token;
                if (!token) continue;
                if (Array.isArray(token)) continue;

                if (filteredTags.some(tag => token.includes(tag))) {
                    continue;
                }

                if (!showThinking && grokResp.isThinking) {
                    continue;
                }

                yield makeChunk(token, model);
            } catch {
                continue;
            }
        }
    }

    yield makeChunk('', model, 'stop');
    yield 'data: [DONE]\n\n';
}

async function appendImages(content: string, images: string[], authToken: string): Promise<string> {
    const imageMode = getConfigValue('grok.image_mode', 'url') as string;
    for (const img of images) {
        if (imageMode === 'base64') {
            const base64 = await grokImageCache.downloadBase64(`/${img}`, authToken);
            if (base64) content += `\n![Generated Image](${base64})`;
            else content += `\n![Generated Image](https://assets.grok.com/${img})`;
        } else {
            const cached = await grokImageCache.downloadFile(`/${img}`, authToken);
            const imgPath = img.replace(/\//g, '-');
            const baseUrl = getConfigValue('grok.base_url', '') as string;
            const imgUrl = baseUrl ? `${baseUrl}/images/image/${imgPath}` : `/images/image/${imgPath}`;
            content += `\n![Generated Image](${cached ? imgUrl : `https://assets.grok.com/${img}`})`;
        }
    }
    return content;
}

async function buildVideoContent(videoUrl: string, authToken: string): Promise<string> {
    const baseUrl = getConfigValue('grok.base_url', '') as string;
    const fullUrl = `https://assets.grok.com/${videoUrl}`;
    const cached = await grokVideoCache.downloadFile(`/${videoUrl}`, authToken);
    if (cached) {
        const videoPath = videoUrl.replace(/\//g, '-');
        const localUrl = baseUrl ? `${baseUrl}/images/video/${videoPath}` : `/images/video/${videoPath}`;
        return `<video src="${localUrl}" controls="controls" width="500" height="300"></video>\n`;
    }
    return `<video src="${fullUrl}" controls="controls" width="500" height="300"></video>\n`;
}
