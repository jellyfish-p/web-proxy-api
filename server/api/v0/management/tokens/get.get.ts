import { requireAuth } from '../../../../utils/auth';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
        const filePath = resolve(process.cwd(), 'accounts', project, filename);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        return {
            success: true,
            project,
            filename,
            data
        };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to get token: ${error.message}`
        });
    }
});
