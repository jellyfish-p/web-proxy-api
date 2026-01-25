import { requireAuth } from '../../../../utils/auth';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const body = await readBody(event);
    const { project, filename } = body;

    if (!project || !filename) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Project and filename are required'
        });
    }

    try {
        const filePath = resolve(process.cwd(), 'accounts', project, filename);
        await unlink(filePath);

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
