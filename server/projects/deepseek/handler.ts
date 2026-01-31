import {
    chooseNewAccount,
    getAccountIdentifier,
    releaseAccount,
    initAccounts,
} from '../../utils/deepseek/accounts';
import {
    type RequestState,
    DEEPSEEK_COMPLETION_URL,
    get_auth_headers,
    create_session,
    get_pow_response,
    login_deepseek_via_account,
} from '../../utils/deepseek/api';
import { getConfigValue } from '../../utils/config';
import { proxyFetch } from '../../utils/proxy-fetch';

// ----------------------------------------------------------------------
// Helper: Messages Prepare (Ported from Python)
// ----------------------------------------------------------------------
function messages_prepare(messages: any[]): string {
    const processed: { role: string, text: string }[] = [];
    
    for (const m of messages) {
        const role = m.role || "";
        const content = m.content || "";
        let text = "";
        
        if (Array.isArray(content)) {
            const texts = content
                .filter(item => item.type === "text")
                .map(item => item.text || "");
            text = texts.join("\n");
        } else {
            text = String(content);
        }
        processed.push({ role, text });
    }

    if (processed.length === 0) return "";

    // Merge consecutive messages from same role
    const merged = [processed[0]];
    for (let i = 1; i < processed.length; i++) {
        const msg = processed[i];
        const lastMerged = merged[merged.length - 1];
        if (msg && lastMerged && msg.role === lastMerged.role) {
            lastMerged.text += "\n\n" + msg.text;
        } else {
            merged.push(msg);
        }
    }

    const parts: string[] = [];
    for (let idx = 0; idx < merged.length; idx++) {
        const block = merged[idx];
        if (!block) continue;
        const role = block.role;
        const text = block.text;

        if (role === "assistant") {
            parts.push(`<｜Assistant｜>${text}<｜end▁of▁sentence｜>`);
        } else if (role === "user" || role === "system") {
            if (idx > 0) {
                parts.push(`<｜User｜>${text}`);
            } else {
                parts.push(text);
            }
        } else {
            parts.push(text);
        }
    }

    let final_prompt = parts.join("");
    // Remove markdown image syntax
    final_prompt = final_prompt.replace(/!\[(.*?)\]\((.*?)\)/g, "[$1]($2)");
    return final_prompt;
}

export interface DeepSeekHandlerParams {
    authToken: string;
    body: any;
}

export async function handleDeepSeekRequest(params: DeepSeekHandlerParams) {
    const { authToken, body } = params;
    
    // Ensure accounts are initialized
    await initAccounts();

    const configKeys = getConfigValue('keys', []);
    const state: RequestState = {};

    if (configKeys.includes(authToken)) {
        state.use_config_token = true;
        state.tried_accounts = [];
        
        const selection = await chooseNewAccount(state.tried_accounts);
        if (!selection) {
            throw new Error("No accounts configured or all accounts are busy.");
        }
        
        state.account = selection.account;
        state.account_filename = selection.id;
        state.tried_accounts.push(getAccountIdentifier(state.account));
        state.proxy_url = state.account.proxy_url;  // Set proxy URL from account

        if (!state.account.token?.trim()) {
            try {
                await login_deepseek_via_account(state.account, state.account_filename);
            } catch (e) {
                console.error(`[DeepSeek] Account login failed: ${e}`);
                throw new Error("Account login failed.");
            }
        }
        state.deepseek_token = state.account.token;
    } else {
        state.use_config_token = false;
        state.deepseek_token = authToken;
    }

    const { model, messages, stream } = body;

    if (!model || !messages) {
        throw new Error("Request must include 'model' and 'messages'.");
    }

    let thinking_enabled = false;
    let search_enabled = false;
    const modelLower = model.toLowerCase();

    if (modelLower === "deepseek-chat") {
        thinking_enabled = false;
        search_enabled = false;
    } else if (modelLower === "deepseek-reasoner") {
        thinking_enabled = true;
        search_enabled = false;
    } else if (modelLower === "deepseek-chat-search") {
        thinking_enabled = false;
        search_enabled = true;
    } else if (modelLower === "deepseek-reasoner-search") {
        thinking_enabled = true;
        search_enabled = true;
    } else {
        throw new Error(`Model '${model}' is not available.`);
    }

    const final_prompt = messages_prepare(messages);
    
    // Create Session
    const session_id = await create_session({ state });
    if (!session_id) {
        if (state.use_config_token && state.account_filename) releaseAccount(state.account_filename);
        throw new Error("Invalid token or failed to create session.");
    }

    // Get PoW
    const pow_resp = await get_pow_response({ state });
    if (!pow_resp) {
        if (state.use_config_token && state.account_filename) releaseAccount(state.account_filename);
        throw new Error("Failed to get PoW.");
    }

    const headers = {
        ...get_auth_headers(state),
        "x-ds-pow-response": pow_resp
    };

    const payload = {
        chat_session_id: session_id,
        parent_message_id: null,
        prompt: final_prompt,
        ref_file_ids: [],
        thinking_enabled,
        search_enabled,
    };

    const dsResponse = await proxyFetch(
        DEEPSEEK_COMPLETION_URL,
        {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        },
        state.proxy_url
    );

    if (!dsResponse.ok) {
        if (state.use_config_token && state.account_filename) releaseAccount(state.account_filename);
        throw new Error(`DeepSeek API error: ${dsResponse.status}`);
    }

    return {
        response: dsResponse,
        state,
        session_id,
        model,
        thinking_enabled,
        search_enabled
    };
}

export function releaseDeepSeekAccount(state: RequestState) {
    if (state.use_config_token && state.account_filename) {
        releaseAccount(state.account_filename);
    }
}
