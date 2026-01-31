import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getConfigValue } from '../config';
import { getDynamicHeaders } from './statsig';
import { getGrokProxy } from './proxy-pool';

const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
};

const DEFAULT_MIME = 'image/jpeg';
const ASSETS_URL = 'https://assets.grok.com';

class CacheService {
    private cacheDir: string;
    private cacheType: string;
    private timeoutMs: number;
    private cleanupInProgress = false;

    constructor(cacheType: 'image' | 'video', timeoutMs = 30000) {
        this.cacheType = cacheType;
        this.timeoutMs = timeoutMs;
        this.cacheDir = resolve(process.cwd(), 'data', 'temp', cacheType);
    }

    private async ensureDir() {
        await mkdir(this.cacheDir, { recursive: true });
    }

    private getPath(filePath: string): string {
        return resolve(this.cacheDir, filePath.replace(/^\//, '').replace(/\//g, '-'));
    }

    private async download(filePath: string, authToken: string): Promise<string | null> {
        await this.ensureDir();
        const cachePath = this.getPath(filePath);

        try {
            await import('node:fs/promises').then(({ access }) => access(cachePath));
            return cachePath;
        } catch {
            // file not cached
        }

        const retryCodes = getConfigValue('grok.retry_status_codes', [401, 429]) as number[];
        const maxOuterRetry = 3;
        const max403Retries = 5;

        for (let outer = 0; outer <= maxOuterRetry; outer += 1) {
            let retry403 = 0;
            while (retry403 <= max403Retries) {
                const proxy = await getGrokProxy();
                const fetchOptions: RequestInit & { agent?: any } = {
                    method: 'GET',
                    headers: {
                        ...getDynamicHeaders(filePath),
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-site',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        Referer: 'https://grok.com/',
                        Cookie: authToken
                    }
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

                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
                    const response = await fetch(`${ASSETS_URL}${filePath}`, {
                        ...fetchOptions,
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    if (response.status === 403) {
                        retry403 += 1;
                        if (retry403 <= max403Retries) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            continue;
                        }
                        return null;
                    }

                    if (retryCodes.includes(response.status)) {
                        if (outer < maxOuterRetry) {
                            await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                            break;
                        }
                        return null;
                    }

                    if (!response.ok) {
                        return null;
                    }

                    const buffer = Buffer.from(await response.arrayBuffer());
                    await import('node:fs/promises').then(({ writeFile }) => writeFile(cachePath, buffer));
                    this.cleanup().catch(() => null);
                    return cachePath;
                } catch (error) {
                    if (outer < maxOuterRetry - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                    return null;
                }
            }
        }

        return null;
    }

    async cleanup(): Promise<void> {
        if (this.cleanupInProgress) return;
        this.cleanupInProgress = true;

        try {
            const maxMb = getConfigValue(`grok.${this.cacheType}_cache_max_size_mb`, 500) as number;
            const maxBytes = maxMb * 1024 * 1024;
            const { readdir, stat, unlink } = await import('node:fs/promises');

            const files = await readdir(this.cacheDir);
            const entries: Array<{ path: string; size: number; mtime: number }> = [];
            let total = 0;

            for (const file of files) {
                const fullPath = resolve(this.cacheDir, file);
                const info = await stat(fullPath);
                if (info.isFile()) {
                    entries.push({ path: fullPath, size: info.size, mtime: info.mtimeMs });
                    total += info.size;
                }
            }

            if (total <= maxBytes) return;

            entries.sort((a, b) => a.mtime - b.mtime);
            for (const entry of entries) {
                if (total <= maxBytes) break;
                await unlink(entry.path);
                total -= entry.size;
            }
        } finally {
            this.cleanupInProgress = false;
        }
    }

    async downloadBase64(path: string, authToken: string): Promise<string | null> {
        const cachePath = await this.download(path, authToken);
        if (!cachePath) return null;
        try {
            const { readFile, unlink } = await import('node:fs/promises');
            const buffer = await readFile(cachePath);
            const ext = cachePath.slice(cachePath.lastIndexOf('.')) || '.jpg';
            const mime = MIME_TYPES[ext] || DEFAULT_MIME;
            await unlink(cachePath).catch(() => null);
            return `data:${mime};base64,${buffer.toString('base64')}`;
        } catch {
            return null;
        }
    }

    async downloadFile(path: string, authToken: string): Promise<string | null> {
        return this.download(path, authToken);
    }
}

export const grokImageCache = new CacheService('image', 30000);
export const grokVideoCache = new CacheService('video', 60000);
