import { requireAuth } from '../../../../utils/auth';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const body = await readBody(event);
    const { project, type, data } = body;

    if (!project || !type || !data) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Project, type, and data are required'
        });
    }

    // Validate type
    if (!['session', 'password'].includes(type)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Type must be either "session" or "password"'
        });
    }

    try {
        const accountsDir = resolve(process.cwd(), 'accounts', project);
        
        // Ensure directory exists
        await mkdir(accountsDir, { recursive: true });

        let accountData: any = {};
        let filename: string;

        if (type === 'session') {
            // Session-based token
            if (!data.token) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Bad Request',
                    message: 'Token is required for session type'
                });
            }
            
            accountData = {
                token: data.token,
                device_id: data.device_id || '',
                type: 'session',
                created_at: new Date().toISOString()
            };
            
            filename = `session-${Date.now()}.json`;
        } else {
            // Password-based account
            if (data.email) {
                accountData.email = data.email;
                filename = `${data.email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            } else if (data.mobile) {
                accountData.mobile = data.mobile;
                filename = `${data.mobile.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            } else {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Bad Request',
                    message: 'Email or mobile is required for password type'
                });
            }

            if (!data.password) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Bad Request',
                    message: 'Password is required for password type'
                });
            }

            accountData.password = data.password;
            accountData.token = data.token || '';
            accountData.device_id = data.device_id || '';
            accountData.type = 'password';
            accountData.created_at = new Date().toISOString();
        }

        const filePath = resolve(accountsDir, filename);
        await writeFile(filePath, JSON.stringify(accountData, null, 2), 'utf-8');

        // Invalidate cache for this project to pick up the new token
        const { tokenCache } = await import('../../../../utils/token-cache');
        tokenCache.invalidateProject(project);

        return {
            success: true,
            message: 'Token added successfully',
            filename,
            project
        };
    } catch (error: any) {
        if (error.statusCode) {
            throw error;
        }
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: `Failed to add token: ${error.message}`
        });
    }
});
