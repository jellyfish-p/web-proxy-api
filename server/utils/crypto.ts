import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * 密码加密前缀，用于识别已加密的密码
 */
const ENCRYPTED_PREFIX = '$encrypted$';

/**
 * 检查密码是否已加密
 */
export function isPasswordEncrypted(password: string): boolean {
    return typeof password === 'string' && password.startsWith(ENCRYPTED_PREFIX);
}

/**
 * 使用 PBKDF2 加密密码
 * @param password 明文密码
 * @returns 加密后的密码字符串
 */
export function encryptPassword(password: string): string {
    if (isPasswordEncrypted(password)) {
        return password; // 已加密，直接返回
    }

    // 生成随机盐值
    const salt = randomBytes(16).toString('hex');
    
    // 使用 PBKDF2 进行密码哈希
    const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    
    // 格式: $encrypted$salt$hash
    return `${ENCRYPTED_PREFIX}${salt}$${hash}`;
}

/**
 * 验证密码
 * @param inputPassword 用户输入的明文密码
 * @param storedPassword 存储的密码（可能是明文或加密后的）
 * @returns 是否匹配
 */
export function verifyPassword(inputPassword: string, storedPassword: string): boolean {
    // 如果存储的密码未加密，直接比较
    if (!isPasswordEncrypted(storedPassword)) {
        return inputPassword === storedPassword;
    }

    // 解析加密密码
    const parts = storedPassword.substring(ENCRYPTED_PREFIX.length).split('$');
    if (parts.length !== 2) {
        console.error('Invalid encrypted password format');
        return false;
    }

    const [salt, storedHash] = parts;
    
    // 使用相同的盐值和参数对输入密码进行哈希
    const inputHash = pbkdf2Sync(inputPassword, salt, 100000, 64, 'sha512').toString('hex');
    
    // 比较哈希值
    return inputHash === storedHash;
}

/**
 * 生成简单的哈希（用于 API keys 等）
 */
export function simpleHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}
