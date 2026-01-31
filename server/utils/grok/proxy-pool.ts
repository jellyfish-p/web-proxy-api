import { getConfigValue } from '../config';

let staticProxy: string | null = null;
let poolUrl: string | null = null;
let currentProxy: string | null = null;
let lastFetchTime = 0;
let fetchInterval = 300;
let enabled = false;

function normalizeProxy(proxy: string): string {
    let value = proxy.trim();
    if (value.startsWith('sock5h://')) value = value.replace('sock5h://', 'socks5h://');
    if (value.startsWith('sock5://')) value = value.replace('sock5://', 'socks5://');
    if (value.startsWith('socks5://')) value = value.replace('socks5://', 'socks5h://');
    return value;
}

function looksLikeProxyUrl(url: string): boolean {
    return url.startsWith('sock5://') || url.startsWith('sock5h://') || url.startsWith('socks5://') || url.startsWith('socks5h://');
}

function validateProxy(proxy: string): boolean {
    if (!proxy) return false;
    return proxy.startsWith('http://') || proxy.startsWith('https://') || proxy.startsWith('socks5://') || proxy.startsWith('socks5h://');
}

async function fetchProxy(): Promise<void> {
    if (!poolUrl) return;
    try {
        const response = await fetch(poolUrl);
        if (!response.ok) {
            console.error(`[GrokProxyPool] Failed to fetch proxy: HTTP ${response.status}`);
            if (!currentProxy) currentProxy = staticProxy;
            return;
        }
        const text = (await response.text()).trim();
        const normalized = normalizeProxy(text);
        if (validateProxy(normalized)) {
            currentProxy = normalized;
            lastFetchTime = Date.now() / 1000;
            console.log(`[GrokProxyPool] New proxy: ${currentProxy}`);
        } else {
            console.error(`[GrokProxyPool] Invalid proxy format: ${normalized}`);
            if (!currentProxy) currentProxy = staticProxy;
        }
    } catch (error) {
        console.error(`[GrokProxyPool] Proxy fetch error: ${error}`);
        if (!currentProxy) currentProxy = staticProxy;
    }
}

export async function configureGrokProxyPool(): Promise<void> {
    const proxyUrl = getConfigValue('grok.proxy_url', '') as string;
    const proxyPoolUrl = getConfigValue('grok.proxy_pool_url', '') as string;
    const poolInterval = getConfigValue('grok.proxy_pool_interval', 300) as number;

    staticProxy = proxyUrl ? normalizeProxy(proxyUrl) : null;
    poolUrl = proxyPoolUrl ? proxyPoolUrl.trim() : null;

    if (poolUrl && looksLikeProxyUrl(poolUrl)) {
        if (!staticProxy) {
            staticProxy = normalizeProxy(poolUrl);
            console.warn('[GrokProxyPool] proxy_pool_url looks like proxy address; using as static proxy');
        } else {
            console.warn('[GrokProxyPool] proxy_pool_url looks like proxy address; ignoring because proxy_url is set');
        }
        poolUrl = null;
    }

    fetchInterval = poolInterval;
    enabled = Boolean(poolUrl);

    if (enabled) {
        console.log(`[GrokProxyPool] Enabled with pool ${poolUrl}, interval ${fetchInterval}s`);
    } else if (staticProxy) {
        currentProxy = staticProxy;
        console.log(`[GrokProxyPool] Using static proxy ${staticProxy}`);
    } else {
        console.log('[GrokProxyPool] Proxy disabled');
    }
}

export async function getGrokProxy(): Promise<string | null> {
    if (!enabled) return staticProxy;
    const now = Date.now() / 1000;
    if (!currentProxy || now - lastFetchTime >= fetchInterval) {
        await fetchProxy();
    }
    return currentProxy || staticProxy;
}

export async function forceRefreshGrokProxy(): Promise<string | null> {
    if (!enabled) return staticProxy;
    await fetchProxy();
    return currentProxy || staticProxy;
}

export function getCurrentGrokProxy(): string | null {
    return currentProxy || staticProxy;
}
