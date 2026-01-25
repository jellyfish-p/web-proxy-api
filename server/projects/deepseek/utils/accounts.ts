import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ACCOUNTS_DIR = resolve(process.cwd(), 'accounts/deepseek');

export interface Account {
    email?: string;
    mobile?: string;
    password?: string;
    token?: string;
    device_id?: string;
    [key: string]: any;
}

let accountQueue: string[] = [];
const activeAccounts = new Set<string>();

export async function initAccounts() {
    try {
        const files = await readdir(ACCOUNTS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        accountQueue = jsonFiles.sort(() => Math.random() - 0.5); // Shuffle
        console.log(`[DeepSeek] Loaded ${accountQueue.length} accounts from ${ACCOUNTS_DIR}`);
    } catch (error) {
        console.error(`[DeepSeek] Failed to initialize accounts: ${error}`);
    }
}

export async function getAccount(identifier: string): Promise<Account | null> {
    try {
        const filePath = resolve(ACCOUNTS_DIR, identifier);
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`[DeepSeek] Failed to load account ${identifier}: ${error}`);
        return null;
    }
}

export async function saveAccount(identifier: string, data: Account) {
    try {
        const filePath = resolve(ACCOUNTS_DIR, identifier);
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`[DeepSeek] Failed to save account ${identifier}: ${error}`);
    }
}

export function getAccountIdentifier(account: Account): string {
    return account.email?.trim() || account.mobile?.trim() || 'unknown';
}

/**
 * Chooses a new account that is not in the excluded list.
 * Returns the filename (identifier) and the account object.
 */
export async function chooseNewAccount(excludeIds: string[] = []): Promise<{ id: string, account: Account } | null> {
    if (accountQueue.length === 0) {
        await initAccounts();
    }

    for (const filename of accountQueue) {
        const account = await getAccount(filename);
        if (!account) continue;

        const id = getAccountIdentifier(account);
        
        if (!excludeIds.includes(id)) {
            return { id: filename, account };
        }
    }
    
    return null;
}

export function releaseAccount(filename: string) {
    const index = accountQueue.indexOf(filename);
    if (index > -1) {
        accountQueue.splice(index, 1);
        accountQueue.push(filename);
    }
}
