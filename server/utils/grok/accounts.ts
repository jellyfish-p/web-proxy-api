import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tokenCache } from '../token-cache';
import type { GrokTokenType } from './models';
import { GrokTokenTypes } from './models';

const ACCOUNTS_DIR = resolve(process.cwd(), 'accounts/grok');
const PROJECT_NAME = 'grok';

export interface GrokAccount {
    token: string;
    tokenType: GrokTokenType;
    createdTime?: number;
    remainingQueries?: number;
    heavyremainingQueries?: number;
    status?: 'active' | 'expired';
    failedCount?: number;
    lastFailureTime?: number | null;
    lastFailureReason?: string | null;
    tags?: string[];
    note?: string;
    [key: string]: any;
}

let accountQueue: string[] = [];
const activeAccounts = new Set<string>();

export async function initAccounts() {
    try {
        // Use token cache to get file list
        const jsonFiles = await tokenCache.getTokenList(PROJECT_NAME);
        accountQueue = jsonFiles.sort(() => Math.random() - 0.5); // Shuffle
        console.log(`[Grok] Loaded ${accountQueue.length} accounts from cache`);
        
        // Preload tokens into cache for better performance
        await tokenCache.preloadProject(PROJECT_NAME);
    } catch (error) {
        console.error(`[Grok] Failed to initialize accounts: ${error}`);
    }
}

export async function getAccount(identifier: string): Promise<GrokAccount | null> {
    try {
        // Use token cache to get account data
        const account = await tokenCache.getToken(PROJECT_NAME, identifier);
        return account as GrokAccount | null;
    } catch (error) {
        console.error(`[Grok] Failed to load account ${identifier}: ${error}`);
        return null;
    }
}

export async function saveAccount(identifier: string, data: GrokAccount) {
    try {
        const filePath = resolve(ACCOUNTS_DIR, identifier);
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        
        // Invalidate cache for this token
        tokenCache.invalidateToken(PROJECT_NAME, identifier);
    } catch (error) {
        console.error(`[Grok] Failed to save account ${identifier}: ${error}`);
    }
}

export function getAccountIdentifier(account: GrokAccount): string {
    // Use first 8 characters of token as identifier
    return account.token?.substring(0, 8) || 'unknown';
}

/**
 * Get all accounts from cache
 */
export async function getAllAccounts(): Promise<Map<string, GrokAccount>> {
    const accounts = new Map<string, GrokAccount>();
    
    for (const filename of accountQueue) {
        const account = await getAccount(filename);
        if (account) {
            accounts.set(filename, account);
        }
    }
    
    return accounts;
}

/**
 * Select best token for a given model
 */
export async function selectBestToken(model: string): Promise<{ filename: string; account: GrokAccount } | null> {
    if (accountQueue.length === 0) {
        await initAccounts();
    }

    const field = model === 'grok-4-heavy' ? 'heavyremainingQueries' : 'remainingQueries';
    const MAX_FAILURES = 3;

    // Separate tokens by type and availability
    const normalUnused: Array<{ filename: string; account: GrokAccount }> = [];
    const normalUsed: Array<{ filename: string; account: GrokAccount; remaining: number }> = [];
    const superUnused: Array<{ filename: string; account: GrokAccount }> = [];
    const superUsed: Array<{ filename: string; account: GrokAccount; remaining: number }> = [];

    for (const filename of accountQueue) {
        const account = await getAccount(filename);
        if (!account) continue;
        
        // Skip expired or failed tokens
        if (account.status === 'expired') continue;
        if ((account.failedCount || 0) >= MAX_FAILURES) continue;

        const remaining = Number(account[field] ?? -1);
        if (remaining === 0) continue;

        const tokenType = account.tokenType || GrokTokenTypes.NORMAL;
        
        if (remaining === -1) {
            if (tokenType === GrokTokenTypes.SUPER) {
                superUnused.push({ filename, account });
            } else {
                normalUnused.push({ filename, account });
            }
        } else if (remaining > 0) {
            if (tokenType === GrokTokenTypes.SUPER) {
                superUsed.push({ filename, account, remaining });
            } else {
                normalUsed.push({ filename, account, remaining });
            }
        }
    }

    // Priority: normal unused > normal used > super unused > super used
    if (normalUnused.length > 0) {
        return normalUnused[0] || null;
    }
    
    if (normalUsed.length > 0) {
        normalUsed.sort((a, b) => b.remaining - a.remaining);
        const best = normalUsed[0];
        if (best) {
            return { filename: best.filename, account: best.account };
        }
    }
    
    if (superUnused.length > 0) {
        return superUnused[0] || null;
    }
    
    if (superUsed.length > 0) {
        superUsed.sort((a, b) => b.remaining - a.remaining);
        const best = superUsed[0];
        if (best) {
            return { filename: best.filename, account: best.account };
        }
    }

    return null;
}

/**
 * Update token limits
 */
export async function updateTokenLimits(filename: string, normal?: number, heavy?: number) {
    const account = await getAccount(filename);
    if (!account) return;

    if (normal !== undefined) account.remainingQueries = normal;
    if (heavy !== undefined) account.heavyremainingQueries = heavy;
    
    await saveAccount(filename, account);
}

/**
 * Record token failure
 */
export async function recordTokenFailure(filename: string, status: number, msg: string) {
    const account = await getAccount(filename);
    if (!account) return;

    const MAX_FAILURES = 3;
    account.failedCount = (account.failedCount || 0) + 1;
    account.lastFailureTime = Date.now();
    account.lastFailureReason = `${status}: ${msg}`;
    
    if (status >= 400 && status < 500 && account.failedCount >= MAX_FAILURES) {
        account.status = 'expired';
    }
    
    await saveAccount(filename, account);
}

/**
 * Reset token failure count
 */
export async function resetTokenFailure(filename: string) {
    const account = await getAccount(filename);
    if (!account) return;

    if (account.failedCount && account.failedCount > 0) {
        account.failedCount = 0;
        account.lastFailureTime = null;
        account.lastFailureReason = null;
        await saveAccount(filename, account);
    }
}

/**
 * Release account back to queue (move to end)
 */
export function releaseAccount(filename: string) {
    const index = accountQueue.indexOf(filename);
    if (index > -1) {
        accountQueue.splice(index, 1);
        accountQueue.push(filename);
    }
}
