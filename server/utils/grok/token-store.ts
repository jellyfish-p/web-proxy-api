import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tokenCache } from '../token-cache';
import type { GrokTokenType } from './models';

export type GrokTokenRecord = {
    createdTime: number;
    remainingQueries: number;
    heavyremainingQueries: number;
    status: 'active' | 'expired';
    failedCount: number;
    lastFailureTime: number | null;
    lastFailureReason: string | null;
    tags: string[];
    note: string;
};

export type GrokTokenData = Record<GrokTokenType, Record<string, GrokTokenRecord>>;

const PROJECT_NAME = 'grok';
const ACCOUNTS_DIR = resolve(process.cwd(), 'accounts', PROJECT_NAME);

let tokenData: GrokTokenData | null = null;
let dataLoaded = false;

const DEFAULT_TOKEN_DATA: GrokTokenData = {
    ssoNormal: {},
    ssoSuper: {}
};

async function loadData(): Promise<GrokTokenData> {
    if (dataLoaded && tokenData) return tokenData;
    const data = await tokenCache.getToken(PROJECT_NAME, 'token.json');
    if (data && typeof data === 'object') {
        tokenData = {
            ssoNormal: (data as any).ssoNormal || {},
            ssoSuper: (data as any).ssoSuper || {}
        };
    } else {
        tokenData = { ...DEFAULT_TOKEN_DATA };
    }
    dataLoaded = true;
    return tokenData;
}

export const grokTokenStore = {
    async getData(): Promise<GrokTokenData> {
        return loadData();
    },
    async setData(next: GrokTokenData): Promise<void> {
        tokenData = next;
        dataLoaded = true;
        const fileData = JSON.stringify(next, null, 2);
        await mkdir(ACCOUNTS_DIR, { recursive: true });
        await writeFile(resolve(ACCOUNTS_DIR, 'token.json'), fileData, 'utf-8');
        tokenCache.invalidateProject(PROJECT_NAME);
    },
    async ensureLoaded(): Promise<GrokTokenData> {
        return loadData();
    },
    async reset(): Promise<void> {
        tokenData = { ...DEFAULT_TOKEN_DATA };
        dataLoaded = true;
        await this.setData(tokenData);
    },
    clearCache(): void {
        dataLoaded = false;
        tokenData = null;
    }
};
