# Token File Memory Cache Implementation

## Overview

This implementation adds an in-memory caching layer for token files to improve performance and reduce file system I/O operations.

## Features

### 1. **Centralized Cache Utility** (`server/utils/token-cache.ts`)

A singleton cache manager that provides:

- **In-memory caching**: Stores token data in memory with configurable TTL (5 minutes default)
- **File list caching**: Caches directory listings to reduce file system scans (30 seconds default)
- **Automatic invalidation**: File system watchers automatically invalidate cache when files change
- **Project-based organization**: Separate cache for each project
- **Preloading support**: Ability to preload all tokens for a project into cache

### 2. **Key Methods**

```typescript
// Get a single token (from cache or file system)
await tokenCache.getToken(project: string, filename: string): Promise<TokenData | null>

// Get list of token files for a project
await tokenCache.getTokenList(project: string): Promise<string[]>

// Get all tokens with data for a project
await tokenCache.getAllTokens(project: string): Promise<Map<string, TokenData>>

// Invalidate specific token cache
tokenCache.invalidateToken(project: string, filename: string): void

// Invalidate entire project cache
tokenCache.invalidateProject(project: string): void

// Preload all tokens for a project
await tokenCache.preloadProject(project: string): Promise<void>

// Get cache statistics
tokenCache.getStats(): Record<string, any>
```

### 3. **Cache Configuration**

- **Cache TTL**: 5 minutes (300,000 ms)
- **Scan Interval**: 30 seconds (30,000 ms)
- **File Watching**: Automatic file system monitoring for changes

## Integration Points

### 1. **DeepSeek Accounts Module** (`server/utils/deepseek/accounts.ts`)

Updated to use token cache:
- `initAccounts()`: Uses cache to load account list and preloads tokens
- `getAccount()`: Retrieves account data from cache
- `saveAccount()`: Invalidates cache after saving

### 2. **Token Management APIs**

All token management endpoints now use the cache:

#### List Tokens (`server/api/v0/management/tokens/list.get.ts`)
- Uses `tokenCache.getTokenList()` instead of direct file system read
- Faster response times for repeated requests

#### Get Token (`server/api/v0/management/tokens/get.get.ts`)
- Uses `tokenCache.getToken()` to retrieve token data
- Returns cached data when available

#### Add Token (`server/api/v0/management/tokens/add.post.ts`)
- Invalidates project cache after adding new token
- Ensures cache stays synchronized

#### Delete Token (`server/api/v0/management/tokens/delete.post.ts`)
- Invalidates specific token cache after deletion
- Maintains cache consistency

### 3. **Cache Statistics API** (`server/api/v0/management/cache/stats.get.ts`)

New endpoint to monitor cache performance:
```
GET /api/v0/management/cache/stats
```

Returns statistics for each project:
- Number of cached tokens
- File list size
- Last scan timestamp
- File watching status

## Performance Benefits

1. **Reduced File System I/O**: 
   - Token data is cached in memory for 5 minutes
   - Directory listings are cached for 30 seconds
   - Significantly reduces disk reads

2. **Faster Response Times**:
   - Cached tokens return immediately without file system access
   - Especially beneficial for frequently accessed tokens

3. **Automatic Synchronization**:
   - File system watchers detect changes automatically
   - Cache invalidation ensures data consistency
   - No manual cache management required

4. **Preloading Support**:
   - Can preload all tokens at startup
   - Eliminates cold start delays

## Usage Examples

### Basic Usage

```typescript
import { tokenCache } from '~/server/utils/token-cache';

// Get a token
const token = await tokenCache.getToken('deepseek', 'session-123.json');

// Get all tokens for a project
const tokens = await tokenCache.getAllTokens('deepseek');

// Preload tokens at startup
await tokenCache.preloadProject('deepseek');
```

### Cache Management

```typescript
// Invalidate specific token after update
tokenCache.invalidateToken('deepseek', 'session-123.json');

// Invalidate entire project cache
tokenCache.invalidateProject('deepseek');

// Get cache statistics
const stats = tokenCache.getStats();
console.log(stats);
// Output:
// {
//   deepseek: {
//     cachedTokens: 10,
//     fileListSize: 10,
//     lastScan: '2026-01-31T12:00:00.000Z',
//     isWatching: true
//   }
// }
```

## Cache Invalidation Strategy

The cache is automatically invalidated in the following scenarios:

1. **File System Changes**: File watcher detects changes and invalidates affected tokens
2. **Manual Invalidation**: APIs explicitly invalidate cache after modifications
3. **TTL Expiration**: Cached data expires after 5 minutes
4. **Scan Interval**: File lists are refreshed every 30 seconds

## Monitoring

Use the cache statistics endpoint to monitor cache performance:

```bash
curl -X GET http://localhost:3000/api/v0/management/cache/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "stats": {
    "deepseek": {
      "cachedTokens": 10,
      "fileListSize": 10,
      "lastScan": "2026-01-31T12:00:00.000Z",
      "isWatching": true
    }
  }
}
```

## Best Practices

1. **Preload at Startup**: Call `preloadProject()` during application initialization for better performance
2. **Monitor Cache Stats**: Regularly check cache statistics to ensure proper operation
3. **Explicit Invalidation**: Always invalidate cache after manual file modifications
4. **Error Handling**: Cache failures fall back to direct file system access

## Technical Details

### Cache Structure

```typescript
interface CacheEntry {
    data: TokenData;
    timestamp: number;
}

interface ProjectCache {
    tokens: Map<string, CacheEntry>;
    fileList: string[];
    lastScan: number;
}
```

### File Watching

The cache uses Node.js `fs.watch()` to monitor token directories:
- Watches for file changes, additions, and deletions
- Automatically invalidates affected cache entries
- Handles errors gracefully without crashing

### Thread Safety

The cache is designed for single-threaded Node.js environments. For multi-process deployments, consider:
- Using a shared cache (Redis, Memcached)
- Implementing cache synchronization between processes
- Using file-based locking mechanisms

## Future Enhancements

Potential improvements for future versions:

1. **Distributed Cache**: Support for Redis or Memcached
2. **Cache Warming**: Automatic preloading of frequently accessed tokens
3. **LRU Eviction**: Implement LRU policy for memory management
4. **Metrics**: Add detailed performance metrics and monitoring
5. **Configuration**: Make TTL and scan intervals configurable via config file

## Troubleshooting

### Cache Not Updating

If cache doesn't reflect file changes:
1. Check if file watcher is active: `GET /api/v0/management/cache/stats`
2. Manually invalidate cache: `tokenCache.invalidateProject(project)`
3. Verify file system permissions for watching

### High Memory Usage

If memory usage is high:
1. Reduce cache TTL in `server/utils/token-cache.ts`
2. Implement cache size limits
3. Clear cache periodically: `tokenCache.clearAll()`

### Performance Issues

If performance doesn't improve:
1. Check cache hit rate in statistics
2. Verify preloading is working correctly
3. Monitor file system watcher overhead
