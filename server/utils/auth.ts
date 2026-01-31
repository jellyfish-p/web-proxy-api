import { H3Event, getRequestHeader, getRequestURL } from 'h3';
import { getConfigValue } from './config';
import { verifyPassword } from './crypto';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const isSecureRequest = (event: H3Event): boolean => {
    const forwardedProto = getRequestHeader(event, 'x-forwarded-proto');
    if (forwardedProto) {
        const firstProto = forwardedProto.split(',')[0]?.trim();
        return firstProto === 'https';
    }

    const requestUrl = getRequestURL(event);
    return requestUrl.protocol === 'https:';
};

// In-memory session store (for production, use Redis or database)
const sessions = new Map<string, { username: string; expiresAt: number }>();

export function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function createSession(username: string): string {
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + SESSION_DURATION;
    sessions.set(sessionId, { username, expiresAt });
    
    // Clean up expired sessions
    cleanupExpiredSessions();
    
    return sessionId;
}

export function validateSession(sessionId: string): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;
    
    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        return false;
    }
    
    return true;
}

export function deleteSession(sessionId: string): void {
    sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(sessionId);
        }
    }
}

export function validateAdminCredentials(username: string, password: string): boolean {
    const adminUsername = getConfigValue('admin.username', 'admin');
    const adminPassword = getConfigValue('admin.password', 'admin123');
    
    // 验证用户名
    if (username !== adminUsername) {
        return false;
    }
    
    // 使用加密验证函数验证密码（支持明文和加密密码）
    return verifyPassword(password, adminPassword);
}

export function getSessionFromEvent(event: H3Event): string | null {
    const sessionId = getCookie(event, SESSION_COOKIE_NAME);
    return sessionId || null;
}

export function setSessionCookie(event: H3Event, sessionId: string): void {
    setCookie(event, SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: isSecureRequest(event),
        sameSite: 'lax',
        maxAge: SESSION_DURATION / 1000,
        path: '/'
    });
}

export function clearSessionCookie(event: H3Event): void {
    deleteCookie(event, SESSION_COOKIE_NAME);
}

export function requireAuth(event: H3Event): void {
    const sessionId = getSessionFromEvent(event);
    
    if (!sessionId || !validateSession(sessionId)) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Authentication required'
        });
    }
}
