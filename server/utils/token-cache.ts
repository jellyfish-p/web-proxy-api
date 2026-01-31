import { readdir, readFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';

export interface TokenData {
    email?: string;
    mobile?: string;
    password?: string;
    token?: string;
    device_id?: string;
    type?: 'session' | 'password';
    created_at?: string;
    proxy_url?: string;
    [key: string]: any;
}

interface CacheEntry {
    data: TokenData;
    timestamp: number;
}

interface ProjectCache {
    tokens: Map<string, CacheEntry>;
    fileList: string[];
    lastScan: number;
}

class TokenCache {
    private cache: Map<string, ProjectCache> = new Map();
    private watchers: Map<string, FSWatcher> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly SCAN_INTERVAL = 30 * 1000; // 30 seconds

    /**
     * Get token data from cache or file system
     */
    async getToken(project: string, filename: string): Promise<TokenData | null> {
        const projectCache = this.getProjectCache(project);
        const cached = projectCache.tokens.get(filename);

        // Return cached data if still valid
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        // Load from file system
        try {
            const filePath = resolve(process.cwd(), 'accounts', project, filename);
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content) as TokenData;

            // Update cache
            projectCache.tokens.set(filename, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`[TokenCache] Failed to load token ${project}/${filename}:`, error);
            // Remove from cache if file doesn't exist
            projectCache.tokens.delete(filename);
            return null;
        }
    }

    /**
     * Get list of token files for a project
     */
    async getTokenList(project: string): Promise<string[]> {
        const projectCache = this.getProjectCache(project);

        // Return cached list if recent
        if (Date.now() - projectCache.lastScan < this.SCAN_INTERVAL) {
            return [...projectCache.fileList];
        }

        // Scan directory
        try {
            const accountsDir = resolve(process.cwd(), 'accounts', project);
            const files = await readdir(accountsDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            // Update cache
            projectCache.fileList = jsonFiles;
            projectCache.lastScan = Date.now();

            // Start watching directory if not already watching
            this.startWatching(project, accountsDir);

            return [...jsonFiles];
        } catch (error) {
            console.error(`[TokenCache] Failed to list tokens for ${project}:`, error);
            return [];
        }
    }

    /**
     * Get all tokens for a project (with data)
     */
    async getAllTokens(project: string): Promise<Map<string, TokenData>> {
        const fileList = await this.getTokenList(project);
        const tokens = new Map<string, TokenData>();

        await Promise.all(
            fileList.map(async (filename) => {
                const data = await this.getToken(project, filename);
                if (data) {
                    tokens.set(filename, data);
                }
            })
        );

        return tokens;
    }

    /**
     * Invalidate cache for a specific token
     */
    invalidateToken(project: string, filename: string): void {
        const projectCache = this.cache.get(project);
        if (projectCache) {
            projectCache.tokens.delete(filename);
            console.log(`[TokenCache] Invalidated cache for ${project}/${filename}`);
        }
    }

    /**
     * Invalidate entire project cache
     */
    invalidateProject(project: string): void {
        const projectCache = this.cache.get(project);
        if (projectCache) {
            projectCache.tokens.clear();
            projectCache.fileList = [];
            projectCache.lastScan = 0;
            console.log(`[TokenCache] Invalidated cache for project ${project}`);
        }
    }

    /**
     * Clear all caches
     */
    clearAll(): void {
        this.cache.clear();
        this.stopAllWatchers();
        console.log('[TokenCache] Cleared all caches');
    }

    /**
     * Preload tokens for a project into cache
     */
    async preloadProject(project: string): Promise<void> {
        console.log(`[TokenCache] Preloading tokens for project ${project}...`);
        const tokens = await this.getAllTokens(project);
        console.log(`[TokenCache] Preloaded ${tokens.size} tokens for project ${project}`);
    }

    /**
     * Get or create project cache
     */
    private getProjectCache(project: string): ProjectCache {
        let projectCache = this.cache.get(project);
        if (!projectCache) {
            projectCache = {
                tokens: new Map(),
                fileList: [],
                lastScan: 0
            };
            this.cache.set(project, projectCache);
        }
        return projectCache;
    }

    /**
     * Start watching a directory for changes
     */
    private startWatching(project: string, dirPath: string): void {
        if (this.watchers.has(project)) {
            return; // Already watching
        }

        try {
            const watcher = watch(dirPath, { recursive: false }, (eventType, filename) => {
                if (filename && filename.endsWith('.json')) {
                    console.log(`[TokenCache] File change detected: ${project}/${filename} (${eventType})`);
                    this.invalidateToken(project, filename);
                    
                    // Also invalidate file list to pick up new/deleted files
                    const projectCache = this.cache.get(project);
                    if (projectCache) {
                        projectCache.lastScan = 0;
                    }
                }
            });

            watcher.on('error', (error) => {
                console.error(`[TokenCache] Watcher error for ${project}:`, error);
            });

            this.watchers.set(project, watcher);
            console.log(`[TokenCache] Started watching ${project} directory`);
        } catch (error) {
            console.error(`[TokenCache] Failed to start watching ${project}:`, error);
        }
    }

    /**
     * Stop watching a directory
     */
    private stopWatching(project: string): void {
        const watcher = this.watchers.get(project);
        if (watcher) {
            watcher.close();
            this.watchers.delete(project);
            console.log(`[TokenCache] Stopped watching ${project} directory`);
        }
    }

    /**
     * Stop all watchers
     */
    private stopAllWatchers(): void {
        for (const [project, watcher] of this.watchers) {
            watcher.close();
            console.log(`[TokenCache] Stopped watching ${project} directory`);
        }
        this.watchers.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        
        for (const [project, projectCache] of this.cache) {
            stats[project] = {
                cachedTokens: projectCache.tokens.size,
                fileListSize: projectCache.fileList.length,
                lastScan: new Date(projectCache.lastScan).toISOString(),
                isWatching: this.watchers.has(project)
            };
        }

        return stats;
    }
}

// Export singleton instance
export const tokenCache = new TokenCache();
