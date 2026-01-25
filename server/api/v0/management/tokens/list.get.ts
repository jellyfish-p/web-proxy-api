import { requireAuth } from '../../../../utils/auth';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const query = getQuery(event);
    const project = query.project as string || 'deepseek';

    try {
        const accountsDir = resolve(process.cwd(), 'accounts', project);
        const files = await readdir(accountsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

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
