import { requireAuth } from '../../../../utils/auth';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { GrokTokenType } from '../../../../utils/grok/models';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const body = await readBody(event);
    const { project, filename, type, token } = body;

    if (!project || !filename) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Project and filename are required'
        });
    }

    try {
        if (project === 'grok' && filename === 'token.json') {
            if (!type || !['ssoNormal', 'ssoSuper'].includes(type) || !token) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Bad Request',
                    message: 'type (ssoNormal/ssoSuper) and token are required for grok'
                });
            }

            const { grokTokenStore } = await import('../../../../utils/grok/token-store');
            const store = await grokTokenStore.getData();

            if (store[type as GrokTokenType]?.[token]) {
                delete store[type as GrokTokenType][token];
                await grokTokenStore.setData(store);
            }

            return {
                success: true,
                message: 'Grok token deleted successfully',
                filename,
                project
            };
        }

        const filePath = resolve(process.cwd(), 'accounts', project, filename);
        await unlink(filePath);

        // Invalidate cache for this token
        const { tokenCache } = await import('../../../../utils/token-cache');
        tokenCache.invalidateToken(project, filename);

        return {
            success: true,
            message: 'Token deleted successfully',
            filename,
            project
        };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to delete token: ${error.message}`
        });
    }
});
