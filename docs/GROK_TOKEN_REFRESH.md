# Grok Token Auto-Refresh

## Overview

The Grok token auto-refresh service automatically monitors and updates the remaining token counts for all Grok accounts. This ensures that token limits are always up-to-date and helps with efficient token selection.

## Features

- **Automatic Token Refresh**: Automatically fetches and saves remaining token counts for all Grok tokens
- **Smart Timing**: Refreshes tokens 1 hour after their last API call (not from last refresh)
- **Proxy Support**: Fully compatible with `proxy_url` and `proxy_pool_url` configurations
- **Background Operation**: Runs in the background without blocking API requests
- **Failure Handling**: Skips expired tokens and tokens with too many failures
- **Rate Limit Protection**: Includes delays between requests to avoid rate limiting

## How It Works

1. **Service Initialization**: The service starts automatically when the Grok project is enabled
2. **Token Tracking**: Each time a token is used for an API call, its usage time is recorded
3. **Periodic Checks**: Every 10 minutes, the service checks which tokens need refreshing
4. **Refresh Logic**: Tokens are refreshed if 1 hour has passed since their last API call
5. **Data Persistence**: Updated token counts are automatically saved to account files

## Configuration

Add to your `config.yaml`:

```yaml
grok:
  # Enable/disable automatic token refresh (default: true)
  auto_refresh_tokens: true
  
  # Proxy configuration (used by refresh service)
  proxy_url: "socks5h://127.0.0.1:1080"
  # OR use proxy pool
  proxy_pool_url: "http://your-proxy-pool.com/get"
  proxy_pool_interval: 300
  
  # Retry configuration (affects refresh requests)
  retry_status_codes: [401, 429]
```

## Timing Details

- **Refresh Interval**: 1 hour (3600 seconds) from last API call
- **Check Interval**: 10 minutes (service checks for tokens needing refresh)
- **Initial Delay**: 5 seconds after service start
- **Request Delay**: 1 second between each token refresh to avoid rate limiting

## Token Selection Priority

The refresh service respects the existing token selection logic:
1. Skips tokens with `status: 'expired'`
2. Skips tokens with `failedCount >= 3`
3. Updates both `remainingQueries` (normal models) and `heavyremainingQueries` (heavy models)

## API Integration

The service integrates seamlessly with existing code:

```typescript
// In client.ts - automatically marks token as used
import { markTokenUsed } from './token-refresh';

// After successful API call
markTokenUsed(filename);
```

## Monitoring

The service logs its activity:

```
[GrokTokenRefresh] Service started - tokens will refresh 1 hour after last use
[GrokTokenRefresh] Updated token_abc123.json: normal=95, heavy=18
[GrokTokenRefresh] Refreshed 5 tokens
```

## Manual Control

You can also manually control the service:

```typescript
import { 
  startTokenRefreshService, 
  stopTokenRefreshService,
  forceRefreshToken,
  getRefreshStatus 
} from './utils/grok/token-refresh';

// Start service
startTokenRefreshService();

// Stop service
stopTokenRefreshService();

// Force refresh a specific token
const account = await getAccount('token_abc123.json');
await forceRefreshToken('token_abc123.json', account);

// Get refresh status for all tokens
const status = getRefreshStatus();
for (const [filename, info] of status) {
  console.log(`${filename}: last=${new Date(info.lastRefresh)}, next=${new Date(info.nextRefresh)}`);
}
```

## Benefits

1. **Accurate Token Selection**: Always uses up-to-date token counts for optimal selection
2. **Reduced API Failures**: Avoids using tokens that have reached their limits
3. **Better Load Distribution**: Helps distribute requests across available tokens
4. **Automatic Recovery**: Tokens automatically refresh after cooldown periods
5. **Proxy Compatibility**: Works seamlessly with your existing proxy configuration

## Troubleshooting

### Service Not Starting

Check if Grok project is enabled:
```yaml
projects:
  grok:
    enabled: true
```

### Tokens Not Refreshing

1. Check service is enabled: `auto_refresh_tokens: true`
2. Verify tokens are not expired or failed
3. Check proxy configuration if using proxies
4. Review logs for error messages

### High Refresh Frequency

The service only refreshes tokens 1 hour after their last API call, not continuously. If you see frequent refreshes, it means tokens are being actively used.

## Performance Impact

- **Minimal**: Refresh checks run every 10 minutes
- **Non-blocking**: All refresh operations run in background
- **Rate-limited**: 1 second delay between token refreshes
- **Efficient**: Only refreshes tokens that need updating

## Security

- Uses existing authentication mechanisms
- Respects token failure counts and expiration status
- Supports proxy configurations for privacy
- No additional credentials required
