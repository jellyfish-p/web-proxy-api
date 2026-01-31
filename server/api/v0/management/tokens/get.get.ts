import { requireAuth } from '../../../../utils/auth';
import { tokenCache } from '../../../../utils/token-cache';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const query = getQuery(event);
    const project = query.project as string;
    const filename = query.filename as string;

    if (!project || !filename) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Project and filename are required'
        });
    }

    try {
        // Use token cache to get token data
        const data = await tokenCache.getToken(project, filename);

        if (!data) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: 'Token not found'
            });
        }

        return {
            success: true,
            project,
            filename,
            data
        };
    } catch (error: any) {
        if (error.statusCode) {
            throw error;
        }
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to get token: ${error.message}`
        });
    }
});
