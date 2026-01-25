import { validateAdminCredentials, createSession, setSessionCookie } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { username, password } = body;

    if (!username || !password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Username and password are required'
        });
    }

    if (!validateAdminCredentials(username, password)) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid credentials'
        });
    }

    // Create session
    const sessionId = createSession(username);
    setSessionCookie(event, sessionId);

    return {
        success: true,
        message: 'Login successful'
    };
});
