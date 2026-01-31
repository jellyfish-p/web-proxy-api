<template>
    <div class="p-8 flex flex-col">
        <h1 class="text-2xl font-bold">Grok 项目页面</h1>
        <p class="text-gray-400">grok.com 2 api 相关配置</p>
        
        <div class="mt-6">
            <UCard>
                <template #header>
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-semibold">令牌管理</h2>
                            <p class="text-sm text-gray-500 mt-1">
                                管理 Grok 项目的 SSO 令牌（ssoNormal/ssoSuper）
                            </p>
                        </div>
                        <UButton color="primary" icon="i-heroicons-plus" @click="handleAdd">
                            添加令牌
                        </UButton>
                    </div>
                </template>

                <div v-if="tokensLoading" class="flex justify-center py-8">
                    <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl" />
                </div>

                <div v-else-if="tableData.length === 0" class="text-center py-8 text-gray-500">
                    暂无令牌，点击上方按钮添加
                </div>

                <div v-else class="space-y-3">
                    <div v-for="item in tableData" :key="item.token" class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div class="flex justify-between items-start">
                            <div class="flex-1 space-y-2">
                                <div class="flex items-center gap-3">
                                    <span class="font-mono text-sm font-medium break-all">{{ item.token }}</span>
                                    <UBadge :color="item.type === 'ssoSuper' ? 'warning' : 'primary'">
                                        {{ item.type }}
                                    </UBadge>
                                </div>
                                <div class="text-sm text-gray-500">
                                    创建时间: {{ formatDate(item.createdTime) }}
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <UButton
                                    color="neutral"
                                    variant="ghost"
                                    icon="i-heroicons-eye"
                                    size="sm"
                                    @click="handleViewItem(item)"
                                >
                                    查看
                                </UButton>
                                <UButton
                                    color="error"
                                    variant="ghost"
                                    icon="i-heroicons-trash"
                                    size="sm"
                                    @click="handleDelete(item)"
                                >
                                    删除
                                </UButton>
                            </div>
                        </div>
                    </div>
                </div>
            </UCard>
        </div>

        <!-- Add Token Modal -->
        <AddTokenModal
            v-model:open="addModalOpen"
            v-model:form="addForm"
            :project-options="projectOptions"
            :loading="addLoading"
            @submit="handleAddSubmit"
            @cancel="handleAddCancel"
        />

        <!-- View Token Modal -->
        <ViewTokenModal
            v-model:open="viewModalOpen"
            :token-data="viewTokenData"
            @close="viewModalOpen = false"
        />

        <!-- Delete Token Modal -->
        <DeleteTokenModal
            v-model:open="deleteModalOpen"
            :token-name="deleteTokenName"
            :loading="deleteLoading"
            @confirm="handleDeleteConfirm"
            @cancel="deleteModalOpen = false"
        />
    </div>
</template>

<script setup lang="ts">
import type { NewTokenForm } from '~/composables/useTokens';
import AddTokenModal from '~/components/admin/AddTokenModal.vue';
import ViewTokenModal from '~/components/admin/ViewTokenModal.vue';
import DeleteTokenModal from '~/components/admin/DeleteTokenModal.vue';

definePageMeta({
    middleware: 'auth'
});

interface TokenItem {
    token: string;
    type: 'ssoNormal' | 'ssoSuper';
    createdTime?: number | null;
    [key: string]: any;
}

const currentProject = ref('grok');

const { tokens, tokensLoading, loadTokens, addToken, viewToken, deleteToken } = useTokens(currentProject);

const tableData = ref<TokenItem[]>([]);

const projectOptions = [
    { label: 'Grok', value: 'grok' }
];

const addModalOpen = ref(false);
const addLoading = ref(false);
const addForm = ref<NewTokenForm>({
    project: 'grok',
    type: 'ssoNormal',
    identifier: '',
    password: '',
    token: '',
    device_id: ''
});

const viewModalOpen = ref(false);
const viewTokenData = ref<any>(null);

const deleteModalOpen = ref(false);
const deleteTokenName = ref('');
const deleteTokenType = ref<'ssoNormal' | 'ssoSuper' | ''>('');
const deleteLoading = ref(false);

const loadTokensWithMetadata = async () => {
    tokensLoading.value = true;
    try {
        await loadTokens();
        const store = await viewToken('token.json');
        const normalItems = Object.entries(store?.ssoNormal || {}).map(([token, data]: any) => ({
            token,
            type: 'ssoNormal' as const,
            createdTime: data?.createdTime ?? null,
            ...data
        }));
        const superItems = Object.entries(store?.ssoSuper || {}).map(([token, data]: any) => ({
            token,
            type: 'ssoSuper' as const,
            createdTime: data?.createdTime ?? null,
            ...data
        }));
        tableData.value = [...normalItems, ...superItems];
    } catch (error) {
        tableData.value = [];
    } finally {
        tokensLoading.value = false;
    }
};

const handleAdd = () => {
    addForm.value = {
        project: 'grok',
        type: 'ssoNormal',
        identifier: '',
        password: '',
        token: '',
        device_id: ''
    };
    addModalOpen.value = true;
};

const handleAddSubmit = async () => {
    addLoading.value = true;
    try {
        await addToken(addForm.value);
        addModalOpen.value = false;
        await loadTokensWithMetadata();
    } catch (error: any) {
        const toast = useToast();
        toast.add({
            title: '添加失败',
            description: error.data?.message || '无法添加令牌',
            color: 'error'
        });
    } finally {
        addLoading.value = false;
    }
};

const handleAddCancel = () => {
    addModalOpen.value = false;
};

const handleViewItem = (item: TokenItem) => {
    viewTokenData.value = item;
    viewModalOpen.value = true;
};

const handleDelete = (item: TokenItem) => {
    deleteTokenName.value = item.token;
    deleteTokenType.value = item.type;
    deleteModalOpen.value = true;
};

const handleDeleteConfirm = async () => {
    deleteLoading.value = true;
    try {
        if (!deleteTokenType.value || !deleteTokenName.value) {
            throw new Error('Missing delete token info');
        }
        await deleteToken('token.json', { type: deleteTokenType.value, token: deleteTokenName.value });
        deleteModalOpen.value = false;
        await loadTokensWithMetadata();
    } catch (error: any) {
        const toast = useToast();
        toast.add({
            title: '删除失败',
            description: error.data?.message || '无法删除令牌',
            color: 'error'
        });
    } finally {
        deleteLoading.value = false;
    }
};

const formatDate = (time?: number | null) => {
    if (!time) return '未知';
    try {
        const date = new Date(time);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '未知';
    }
};

onMounted(() => {
    loadTokensWithMetadata();
});
</script>
