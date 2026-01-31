import { requireAuth } from '../../../../utils/auth';
import { tokenCache } from '../../../../utils/token-cache';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const query = getQuery(event);
    const project = query.project as string;

    try {
        if (project === 'grok') {
            return {
                success: true,
                project,
                count: 1,
                tokens: ['token.json']
            };
        }

        // Use token cache to get file list
        const jsonFiles = await tokenCache.getTokenList(project);

        return {
            success: true,
            project,
            count: jsonFiles.length,
            tokens: jsonFiles
        };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to list tokens: ${error.message}`
        });
    }
});
