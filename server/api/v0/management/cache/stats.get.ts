import { requireAuth } from '../../../../utils/auth';
import { tokenCache } from '../../../../utils/token-cache';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    try {
        const stats = tokenCache.getStats();

        return {
            success: true,
            stats
        };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to get cache stats: ${error.message}`
        });
    }
});
