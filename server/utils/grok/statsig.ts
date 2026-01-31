import { getConfigValue } from '../config';
import crypto from 'node:crypto';

const BASE_HEADERS: Record<string, string> = {
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    Connection: 'keep-alive',
    Origin: 'https://grok.com',
    Priority: 'u=1, i',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Baggage: 'sentry-environment=production,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c'
};

function randomString(length: number, lettersOnly = true): string {
    const chars = lettersOnly ? 'abcdefghijklmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
        const value = bytes[i] ?? 0;
        const index = value % chars.length;
        out += chars.charAt(index);
    }
    return out;
}

function generateStatsigId(): string {
    if (Math.random() > 0.5) {
        const rand = randomString(5, false);
        const msg = `e:TypeError: Cannot read properties of null (reading 'children['${rand}']')`;
        return Buffer.from(msg).toString('base64');
    }
    const rand = randomString(10, true);
    const msg = `e:TypeError: Cannot read properties of undefined (reading '${rand}')`;
    return Buffer.from(msg).toString('base64');
}

export function getDynamicHeaders(pathname = '/rest/app-chat/conversations/new'): Record<string, string> {
    const dynamicStatsig = getConfigValue('grok.dynamic_statsig', false);
    const statsigId = dynamicStatsig ? generateStatsigId() : getConfigValue('grok.x_statsig_id', '');

    if (!statsigId) {
        throw new Error('Missing grok.x_statsig_id in config when dynamic_statsig is disabled.');
    }

    return {
        ...BASE_HEADERS,
        'x-statsig-id': statsigId,
        'x-xai-request-id': crypto.randomUUID(),
        'Content-Type': pathname.includes('upload-file') ? 'text/plain;charset=UTF-8' : 'application/json'
    };
}
