import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

/**
 * Create a proxy agent based on the proxy URL
 * Supports socks5, socks4, http, and https proxies
 */
function createProxyAgent(proxyUrl: string): any {
    const url = proxyUrl.toLowerCase();
    
    if (url.startsWith('socks5://') || url.startsWith('socks4://') || url.startsWith('socks://')) {
        return new SocksProxyAgent(proxyUrl);
    } else if (url.startsWith('https://')) {
        return new HttpsProxyAgent(proxyUrl);
    } else if (url.startsWith('http://')) {
        return new HttpProxyAgent(proxyUrl);
    } else {
        throw new Error(`Unsupported proxy protocol: ${proxyUrl}`);
    }
}

/**
 * Generic fetch function with optional proxy support
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param proxyUrl - Optional proxy URL (socks5://, socks4://, http://, https://)
 * @returns Fetch response
 */
export async function proxyFetch(
    url: string,
    options: RequestInit = {},
    proxyUrl?: string
): Promise<Response> {
    if (proxyUrl && proxyUrl.trim()) {
        try {
            const agent = createProxyAgent(proxyUrl.trim());
            
            // Add agent to fetch options
            const proxyOptions = {
                ...options,
                // @ts-ignore - agent is not in standard RequestInit but supported by node-fetch
                agent,
            };
            
            console.log(`[ProxyFetch] Using proxy: ${proxyUrl} for ${url}`);
            return await fetch(url, proxyOptions);
        } catch (error) {
            console.error(`[ProxyFetch] Proxy error: ${error}`);
            throw new Error(`Failed to connect through proxy ${proxyUrl}: ${error}`);
        }
    } else {
        // Direct fetch without proxy
        return await fetch(url, options);
    }
}

/**
 * Check if a proxy URL is valid
 */
export function isValidProxyUrl(proxyUrl: string): boolean {
    if (!proxyUrl || !proxyUrl.trim()) {
        return false;
    }
    
    const url = proxyUrl.toLowerCase().trim();
    return (
        url.startsWith('socks5://') ||
        url.startsWith('socks4://') ||
        url.startsWith('socks://') ||
        url.startsWith('http://') ||
        url.startsWith('https://')
    );
}
