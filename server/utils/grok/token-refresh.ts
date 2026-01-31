import { getConfigValue } from '../config';
import { getDynamicHeaders } from './statsig';
import { getGrokProxy, forceRefreshGrokProxy } from './proxy-pool';
import { getAllAccounts, saveAccount, type GrokAccount } from './accounts';

const GROK_API_BASE = 'https://grok.com';
const RATE_LIMIT_API = `${GROK_API_BASE}/rest/rate-limits`;

// Track last refresh time for each token
const lastRefreshTimes = new Map<string, number>();
// Refresh interval: 1 hour (in milliseconds)
const REFRESH_INTERVAL = 60 * 60 * 1000;
// Timer reference
let refreshTimer: NodeJS.Timeout | null = null;
// Service enabled flag
let serviceEnabled = false;

/**
 * Build auth token from raw token
 */
function buildAuthToken(token: string): string {
    return `sso-rw=${token};sso=${token}`;
}

/**
 * Fetch rate limit for a specific token and model
 */
async function fetchRateLimit(
    authToken: string,
    model: string
): Promise<{ remainingQueries?: number; remainingTokens?: number } | null> {
    const payload = { requestKind: 'DEFAULT', modelName: model };
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
                try {
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
                } catch (error) {
                    console.error(`[GrokTokenRefresh] Failed to create proxy agent: ${error}`);
                }
            }

            try {
                const response = await fetch(RATE_LIMIT_API, fetchOptions);
                
                if (response.status === 403) {
                    retry403 += 1;
                    if (retry403 <= max403Retries) {
                        await forceRefreshGrokProxy();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                    console.error(`[GrokTokenRefresh] Rate limit request blocked (403)`);
                    return null;
                }

                if (retryCodes.includes(response.status)) {
                    if (outer < maxOuterRetry) {
                        await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                        break;
                    }
                    console.error(`[GrokTokenRefresh] Rate limit request failed: ${response.status}`);
                    return null;
                }

                if (!response.ok) {
                    console.error(`[GrokTokenRefresh] Rate limit request failed: ${response.status}`);
                    return null;
                }

                const data = await response.json();
                return {
                    remainingQueries: data.remainingQueries,
                    remainingTokens: data.remainingTokens
                };
            } catch (error) {
                console.error(`[GrokTokenRefresh] Fetch error: ${error}`);
                if (outer < maxOuterRetry) {
                    await new Promise(resolve => setTimeout(resolve, (outer + 1) * 100));
                    break;
                }
                return null;
            }
        }
    }

    return null;
}

/**
 * Refresh token limits for a single account
 */
async function refreshTokenLimits(filename: string, account: GrokAccount): Promise<boolean> {
    try {
        const authToken = buildAuthToken(account.token);
        
        // Fetch for normal model (grok-3)
        const normalData = await fetchRateLimit(authToken, 'grok-3');
        if (normalData && normalData.remainingTokens !== undefined) {
            account.remainingQueries = normalData.remainingTokens;
        }

        // Fetch for heavy model (grok-4-heavy)
        const heavyData = await fetchRateLimit(authToken, 'grok-4-heavy');
        if (heavyData && heavyData.remainingQueries !== undefined) {
            account.heavyremainingQueries = heavyData.remainingQueries;
        }

        // Save updated account
        await saveAccount(filename, account);
        
        // Update last refresh time
        lastRefreshTimes.set(filename, Date.now());
        
        console.log(
            `[GrokTokenRefresh] Updated ${filename}: normal=${account.remainingQueries}, heavy=${account.heavyremainingQueries}`
        );
        
        return true;
    } catch (error) {
        console.error(`[GrokTokenRefresh] Failed to refresh ${filename}: ${error}`);
        return false;
    }
}

/**
 * Refresh all tokens that need updating
 */
async function refreshAllTokens(): Promise<void> {
    if (!serviceEnabled) return;

    try {
        const accounts = await getAllAccounts();
        const now = Date.now();
        let refreshCount = 0;

        for (const [filename, account] of accounts) {
            // Skip expired tokens
            if (account.status === 'expired') continue;
            
            // Skip tokens with too many failures
            if ((account.failedCount || 0) >= 3) continue;

            // Check if token needs refresh (1 hour since last refresh)
            const lastRefresh = lastRefreshTimes.get(filename) || 0;
            if (now - lastRefresh < REFRESH_INTERVAL) {
                continue;
            }

            // Refresh token limits
            const success = await refreshTokenLimits(filename, account);
            if (success) {
                refreshCount++;
            }

            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (refreshCount > 0) {
            console.log(`[GrokTokenRefresh] Refreshed ${refreshCount} tokens`);
        }
    } catch (error) {
        console.error(`[GrokTokenRefresh] Error during refresh cycle: ${error}`);
    }
}

/**
 * Mark a token as recently used (reset its refresh timer)
 */
export function markTokenUsed(filename: string): void {
    lastRefreshTimes.set(filename, Date.now());
}

/**
 * Force refresh a specific token immediately
 */
export async function forceRefreshToken(filename: string, account: GrokAccount): Promise<boolean> {
    return await refreshTokenLimits(filename, account);
}

/**
 * Start the automatic token refresh service
 */
export function startTokenRefreshService(): void {
    const enabled = getConfigValue('grok.auto_refresh_tokens', true);
    if (!enabled) {
        console.log('[GrokTokenRefresh] Auto refresh disabled in config');
        return;
    }

    serviceEnabled = true;

    // Run initial refresh after 5 seconds
    setTimeout(() => {
        refreshAllTokens().catch(error => {
            console.error(`[GrokTokenRefresh] Initial refresh failed: ${error}`);
        });
    }, 5000);

    // Set up periodic refresh (check every 10 minutes)
    const checkInterval = 10 * 60 * 1000; // 10 minutes
    refreshTimer = setInterval(() => {
        refreshAllTokens().catch(error => {
            console.error(`[GrokTokenRefresh] Periodic refresh failed: ${error}`);
        });
    }, checkInterval);

    console.log('[GrokTokenRefresh] Service started - tokens will refresh 1 hour after last use');
}

/**
 * Stop the automatic token refresh service
 */
export function stopTokenRefreshService(): void {
    serviceEnabled = false;
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    console.log('[GrokTokenRefresh] Service stopped');
}

/**
 * Get refresh status for all tokens
 */
export function getRefreshStatus(): Map<string, { lastRefresh: number; nextRefresh: number }> {
    const status = new Map<string, { lastRefresh: number; nextRefresh: number }>();
    const now = Date.now();
    
    for (const [filename, lastRefresh] of lastRefreshTimes) {
        status.set(filename, {
            lastRefresh,
            nextRefresh: lastRefresh + REFRESH_INTERVAL
        });
    }
    
    return status;
}
