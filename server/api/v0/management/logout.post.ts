import { requireAuth, clearSessionCookie, deleteSession, getSessionFromEvent } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
    const sessionId = getSessionFromEvent(event);
    
    if (sessionId) {
        deleteSession(sessionId);
        clearSessionCookie(event);
    }

    return {
        success: true,
        message: 'Logout successful'
    };
});
