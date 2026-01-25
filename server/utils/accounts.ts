import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ACCOUNTS_DIR = resolve(process.cwd(), 'accounts');

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
        console.log(`Loaded ${accountQueue.length} accounts from ${ACCOUNTS_DIR}`);
    } catch (error) {
        console.error(`Failed to initialize accounts: ${error}`);
    }
}

export async function getAccount(identifier: string): Promise<Account | null> {
    try {
        const filePath = resolve(ACCOUNTS_DIR, identifier); // identifier is filename for now? or should we scan?
        // Let's assume the identifier in the queue IS the filename
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to load account ${identifier}: ${error}`);
        return null;
    }
}

export async function saveAccount(identifier: string, data: Account) {
    try {
        const filePath = resolve(ACCOUNTS_DIR, identifier);
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Failed to save account ${identifier}: ${error}`);
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

    // Try to find an account not in excludeIds
    for (const filename of accountQueue) {
        // We might need to load it to check the internal ID (email/mobile) if excludeIds uses that
        // Or we can assume excludeIds uses the filename.
        // The python code used `get_account_identifier` (email/mobile) for excludeIds.
        
        // Let's load it to be safe and consistent with Python logic which excludes by ID.
        const account = await getAccount(filename);
        if (!account) continue;

        const id = getAccountIdentifier(account);
        
        if (!excludeIds.includes(id)) {
            // Found one
            return { id: filename, account };
        }
    }
    
    return null;
}

export function releaseAccount(filename: string) {
    // In Python it re-appends to queue. Here we just keep it in the list.
    // The choose logic iterates. If we want rotation, we can move it to the end.
    const index = accountQueue.indexOf(filename);
    if (index > -1) {
        accountQueue.splice(index, 1);
        accountQueue.push(filename);
    }
}
