import { compute_pow_answer } from './wasm';
import { resolve } from 'path';
import { saveAccount, getAccountIdentifier } from './accounts';
import { proxyFetch } from '../../../utils/proxy-fetch';

const DEEPSEEK_HOST = "chat.deepseek.com";
const DEEPSEEK_LOGIN_URL = `https://${DEEPSEEK_HOST}/api/v0/users/login`;
const DEEPSEEK_CREATE_SESSION_URL = `https://${DEEPSEEK_HOST}/api/v0/chat_session/create`;
const DEEPSEEK_CREATE_POW_URL = `https://${DEEPSEEK_HOST}/api/v0/chat/create_pow_challenge`;
export const DEEPSEEK_COMPLETION_URL = `https://${DEEPSEEK_HOST}/api/v0/chat/completion`;

export const BASE_HEADERS = {
    "Host": "chat.deepseek.com",
    "User-Agent": "DeepSeek/1.0.13 Android/35",
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json",
    "x-client-platform": "android",
    "x-client-version": "1.3.0-auto-resume",
    "x-client-locale": "zh_CN",
    "accept-charset": "UTF-8",
};

export interface RequestState {
    use_config_token?: boolean;
    account?: any;
    deepseek_token?: string;
    tried_accounts?: string[];
    account_filename?: string;
    proxy_url?: string;  // Proxy URL from account
}

export interface RequestWithState {
    state: RequestState;
}

export function get_auth_headers(state: RequestState): Record<string, string> {
    return {
        ...BASE_HEADERS,
        "authorization": `Bearer ${state.deepseek_token}`
    };
}

export async function login_deepseek_via_account(account: any, account_filename: string) {
    const email = account.email?.trim();
    const mobile = account.mobile?.trim();
    const password = account.password?.trim();

    if (!password || (!email && !mobile)) {
        throw new Error("Account missing required login info (email/mobile + password)");
    }

    let payload: any;
    if (email) {
        payload = {
            email,
            password,
            device_id: "deepseek_to_api",
            os: "android",
        };
    } else {
        payload = {
            mobile,
            area_code: null,
            password,
            device_id: "deepseek_to_api",
            os: "android",
        };
    }

    try {
        const response = await proxyFetch(
            DEEPSEEK_LOGIN_URL,
            {
                method: 'POST',
                headers: BASE_HEADERS,
                body: JSON.stringify(payload),
            },
            account.proxy_url
        );

        if (!response.ok) {
            throw new Error(`Login request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data?.data?.biz_data?.user?.token) {
            console.error(`[DeepSeek] Invalid login response: ${JSON.stringify(data)}`);
            throw new Error("Account login failed: missing token");
        }

        const new_token = data.data.biz_data.user.token;
        account.token = new_token;
        
        await saveAccount(account_filename, account);
        
        return new_token;

    } catch (e) {
        console.error(`[DeepSeek] Login exception: ${e}`);
        throw e;
    }
}

export async function create_session(request: RequestWithState, max_attempts = 3): Promise<string | null> {
    let attempts = 0;
    while (attempts < max_attempts) {
        const headers = get_auth_headers(request.state);
        try {
            const response = await proxyFetch(
                DEEPSEEK_CREATE_SESSION_URL,
                {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ agent: "chat" })
                },
                request.state.proxy_url
            );
            
            let data: any = {};
            try {
                data = await response.json();
            } catch (jsonErr) {
                 console.error(`[DeepSeek] Session JSON parse error: ${jsonErr}`);
            }

            if (response.ok && data.code === 0) {
                 return data.data.biz_data.id;
            }

            console.warn(`[DeepSeek] Session creation failed: code=${data.code}, msg=${data.msg}`);
            attempts++;
            
        } catch (e) {
            console.error(`[DeepSeek] Session creation exception: ${e}`);
            attempts++;
        }
    }
    return null;
}

export async function get_pow_response(request: RequestWithState, max_attempts = 3): Promise<string | null> {
    let attempts = 0;
    const wasmPath = resolve(process.cwd(), 'server/assets/deepseek_wasm/sha3_wasm_bg.7b9ca65ddd.wasm');

    while (attempts < max_attempts) {
        const headers = get_auth_headers(request.state);
        
        try {
            const response = await proxyFetch(
                DEEPSEEK_CREATE_POW_URL,
                {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ target_path: "/api/v0/chat/completion" }),
                },
                request.state.proxy_url
            );

            if (!response.ok) {
                 attempts++;
                 continue;
            }

            const data = await response.json();

            if (data.code === 0) {
                const challenge = data.data.biz_data.challenge;
                const difficulty = challenge.difficulty || 144000;
                const expire_at = challenge.expire_at || 1680000000;
                
                let answer: number | null = null;
                try {
                     answer = compute_pow_answer(
                        challenge.algorithm,
                        challenge.challenge,
                        challenge.salt,
                        difficulty,
                        expire_at,
                        challenge.signature,
                        challenge.target_path,
                        wasmPath
                    );
                } catch (e) {
                     console.error(`[DeepSeek] PoW calculation exception: ${e}`);
                     answer = null;
                }

                if (answer === null) {
                    attempts++;
                    continue;
                }

                const pow_dict = {
                    algorithm: challenge.algorithm,
                    challenge: challenge.challenge,
                    salt: challenge.salt,
                    answer: answer,
                    signature: challenge.signature,
                    target_path: challenge.target_path,
                };

                const pow_str = JSON.stringify(pow_dict); 
                const encoded = Buffer.from(pow_str, 'utf-8').toString('base64');
                return encoded;

            } else {
                console.warn(`[DeepSeek] PoW failed: code=${data.code}`);
                attempts++;
            }

        } catch (e) {
            console.error(`[DeepSeek] PoW exception: ${e}`);
            attempts++;
        }
    }
    return null;
}
