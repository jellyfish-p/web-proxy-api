// #imports is a Nuxt auto-import alias that provides type-safe access to auto-imported composables
import { ref, useToast } from '#imports';
import type { Ref } from 'vue';

export interface TokenData {
    token?: string;
    device_id?: string;
    account?: string;
    password?: string;
    tokens?: string[];
}

export interface NewTokenForm {
    project: string;
    type: 'session' | 'password' | 'ssoNormal' | 'ssoSuper';
    identifier: string;
    password: string;
    token: string;
    device_id: string;
}

export const useTokens = (currentProject: Ref<string>) => {
    const toast = useToast();
    
    const tokens = ref<string[]>([]);
    const tokensLoading = ref(false);

    const loadTokens = async () => {
        tokensLoading.value = true;
        try {
            const response = await $fetch<any>('/api/v0/management/tokens/list', {
                query: { project: currentProject.value }
            });
            tokens.value = response.tokens;
        } catch (error: any) {
            toast.add({
                title: '加载失败',
                description: error.data?.message || '无法加载令牌列表',
                color: 'error'
            });
        } finally {
            tokensLoading.value = false;
        }
    };

    const addToken = async (tokenForm: NewTokenForm) => {
        const isGrok = tokenForm.project === 'grok';
        const data: TokenData = {
            token: tokenForm.token,
            device_id: tokenForm.device_id
        };

        if (tokenForm.type === 'password') {
            data.account = tokenForm.identifier;
            data.password = tokenForm.password;
        }

        await $fetch('/api/v0/management/tokens/add', {
            method: 'POST',
            body: {
                project: tokenForm.project,
                type: tokenForm.type,
                data: isGrok
                    ? { tokens: tokenForm.token }
                    : data
            }
        });

        toast.add({
            title: '添加成功',
            description: '令牌已成功添加',
            color: 'success'
        });

        await loadTokens();
    };

    const viewToken = async (filename: string) => {
        const response = await $fetch<any>('/api/v0/management/tokens/get', {
            query: {
                project: currentProject.value,
                filename
            }
        });
        return response.data;
    };

    const deleteToken = async (filename: string, options?: { type?: 'ssoNormal' | 'ssoSuper'; token?: string }) => {
        await $fetch('/api/v0/management/tokens/delete', {
            method: 'POST',
            body: {
                project: currentProject.value,
                filename,
                ...options
            }
        });

        toast.add({
            title: '删除成功',
            description: '令牌已成功删除',
            color: 'success'
        });

        await loadTokens();
    };

    return {
        tokens,
        tokensLoading,
        loadTokens,
        addToken,
        viewToken,
        deleteToken
    };
};
