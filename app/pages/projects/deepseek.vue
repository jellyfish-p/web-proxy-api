<template>
    <div class="p-8 flex flex-col">
        <h1 class="text-2xl font-bold">Deepseek 项目页面</h1>
        <p class="text-gray-400">deepseek.com 2 api 相关配置</p>
        
        <div class="mt-6">
            <UCard>
                <template #header>
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-semibold">令牌管理</h2>
                            <p class="text-sm text-gray-500 mt-1">
                                管理 Deepseek 项目的 Session 令牌和账号密码
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

                <div v-else-if="tokens.length === 0" class="text-center py-8 text-gray-500">
                    暂无令牌，点击上方按钮添加
                </div>

                <div v-else class="space-y-3">
                    <div v-for="item in tableData" :key="item.filename"
                        class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div class="flex justify-between items-start">
                            <div class="flex-1 space-y-2">
                                <div class="flex items-center gap-3">
                                    <span class="font-mono text-sm font-medium">{{ item.filename }}</span>
                                    <UBadge :color="item.type === 'session' ? 'primary' : 'secondary'">
                                        {{ item.type === 'session' ? 'Session令牌' : '账号密码' }}
                                    </UBadge>
                                </div>
                                <div class="text-sm text-gray-500">
                                    创建时间: {{ formatDate(item.created_at) }}
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <UButton 
                                    color="neutral" 
                                    variant="ghost" 
                                    icon="i-heroicons-eye" 
                                    size="sm"
                                    @click="handleView(item.filename)"
                                >
                                    查看
                                </UButton>
                                <UButton 
                                    color="error" 
                                    variant="ghost" 
                                    icon="i-heroicons-trash" 
                                    size="sm"
                                    @click="handleDelete(item.filename)"
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

// Define token data type
interface TokenItem {
    filename: string;
    type: string;
    created_at: string;
    [key: string]: any;
}

// Define the project as deepseek
const currentProject = ref('deepseek');

// Use the tokens composable
const { tokens, tokensLoading, loadTokens, addToken, viewToken, deleteToken } = useTokens(currentProject);

// Table data with metadata
const tableData = ref<TokenItem[]>([]);

// Project options for the modal
const projectOptions = [
    { label: 'Deepseek', value: 'deepseek' }
];

// Add modal state
const addModalOpen = ref(false);
const addLoading = ref(false);
const addForm = ref<NewTokenForm>({
    project: 'deepseek',
    type: 'session',
    identifier: '',
    password: '',
    token: '',
    device_id: ''
});

// View modal state
const viewModalOpen = ref(false);
const viewTokenData = ref<any>(null);

// Delete modal state
const deleteModalOpen = ref(false);
const deleteTokenName = ref('');
const deleteLoading = ref(false);

// Load tokens and their metadata
const loadTokensWithMetadata = async () => {
    await loadTokens();
    
    // Load metadata for each token
    const metadataPromises = tokens.value.map(async (filename) => {
        try {
            const data = await viewToken(filename);
            return {
                filename,
                type: data.type || 'session',
                created_at: data.created_at || '',
                ...data
            };
        } catch (error) {
            return {
                filename,
                type: 'unknown',
                created_at: ''
            };
        }
    });
    
    tableData.value = await Promise.all(metadataPromises);
};

// Format date helper
const formatDate = (dateString: string) => {
    if (!dateString) return '未知';
    try {
        const date = new Date(dateString);
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

// Handle add token
const handleAdd = () => {
    addForm.value = {
        project: 'deepseek',
        type: 'session',
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

// Handle view token
const handleView = async (filename: string) => {
    try {
        viewTokenData.value = await viewToken(filename);
        viewModalOpen.value = true;
    } catch (error: any) {
        const toast = useToast();
        toast.add({
            title: '查看失败',
            description: error.data?.message || '无法查看令牌详情',
            color: 'error'
        });
    }
};

// Handle delete token
const handleDelete = (filename: string) => {
    deleteTokenName.value = filename;
    deleteModalOpen.value = true;
};

const handleDeleteConfirm = async () => {
    deleteLoading.value = true;
    try {
        await deleteToken(deleteTokenName.value);
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

// Load tokens on mount
onMounted(() => {
    loadTokensWithMetadata();
});
</script>
