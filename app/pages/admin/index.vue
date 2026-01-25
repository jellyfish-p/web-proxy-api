<template>
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
        <UContainer class="py-8">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">管理面板</h1>
                    <p class="text-gray-600 dark:text-gray-400 mt-1">Web Proxy API 管理系统</p>
                </div>
                <UButton color="error" variant="soft" icon="i-heroicons-arrow-right-on-rectangle" @click="handleLogout">
                    退出登录
                </UButton>
            </div>

            <UTabs v-model="selectedTab" :items="tabs" class="mb-6" />

            <!-- Projects Tab -->
            <div v-if="selectedTab === '0'" class="space-y-6">
                <AdminProjectList 
                    :projects="projects" 
                    :loading="projectsLoading"
                    @select="handleSelectProject" 
                />
            </div>

            <!-- Tokens Tab -->
            <div v-if="selectedTab === '1'" class="space-y-6">
                <AdminTokenList
                    :tokens="tokens"
                    :loading="tokensLoading"
                    :current-project="currentProject"
                    :project-options="projectOptions"
                    @add="handleAddToken"
                    @view="handleViewToken"
                    @delete="handleConfirmDelete"
                    @change-project="handleChangeProject"
                />
            </div>

            <!-- Add Token Modal -->
            <AdminAddTokenModal
                v-model:open="showAddTokenModal"
                v-model:form="newTokenForm"
                :project-options="projectOptions"
                :loading="addingToken"
                @submit="handleSubmitToken"
                @cancel="handleCancelAddToken"
            />

            <!-- View Token Modal -->
            <AdminViewTokenModal
                v-model:open="showViewTokenModal"
                :token-data="viewingTokenData"
                @close="closeViewTokenModal"
            />

            <!-- Delete Confirmation Modal -->
            <AdminDeleteTokenModal
                v-model:open="showDeleteModal"
                :token-name="tokenToDelete"
                :loading="deletingToken"
                @confirm="handleDeleteToken"
                @cancel="closeDeleteModal"
            />
        </UContainer>
    </div>
</template>

<script setup lang="ts">
import type { NewTokenForm } from '~/composables/useTokens';

const { logout } = useAuth();
const router = useRouter();
const toast = useToast();

// Tabs
const selectedTab = ref('0');
const tabs = [
    { label: '项目', icon: 'i-heroicons-cube' },
    { label: '令牌管理', icon: 'i-heroicons-key' }
];

// Use composables
const { 
    projects, 
    projectsLoading, 
    currentProject, 
    projectOptions, 
    loadProjects, 
    selectProject 
} = useProjects();

const { 
    tokens, 
    tokensLoading, 
    loadTokens, 
    addToken, 
    viewToken, 
    deleteToken 
} = useTokens(currentProject);

const {
    showAddTokenModal,
    showViewTokenModal,
    showDeleteModal,
    openAddTokenModal,
    closeAddTokenModal,
    openViewTokenModal,
    closeViewTokenModal,
    openDeleteModal,
    closeDeleteModal
} = useModalState();

// Token operations state
const addingToken = ref(false);
const deletingToken = ref(false);
const tokenToDelete = ref('');
const viewingTokenData = ref<any>(null);

// New token form
const newTokenForm = ref<NewTokenForm>({
    project: 'deepseek',
    type: 'session',
    loginMethod: 'email',
    identifier: '',
    password: '',
    token: '',
    device_id: ''
});

// Handlers
const handleSelectProject = (projectName: string) => {
    selectProject(projectName);
    selectedTab.value = '1';
    loadTokens();
};

const handleChangeProject = (projectName: string) => {
    selectProject(projectName);
    loadTokens();
};

const handleAddToken = () => {
    newTokenForm.value.project = currentProject.value;
    openAddTokenModal();
};

const handleCancelAddToken = () => {
    closeAddTokenModal();
    resetNewTokenForm();
};

const handleSubmitToken = async () => {
    addingToken.value = true;
    try {
        await addToken(newTokenForm.value);
        closeAddTokenModal();
        resetNewTokenForm();
    } catch (error: any) {
        toast.add({
            title: '添加失败',
            description: error.data?.message || '无法添加令牌',
            color: 'error'
        });
    } finally {
        addingToken.value = false;
    }
};

const handleViewToken = async (filename: string) => {
    try {
        viewingTokenData.value = await viewToken(filename);
        openViewTokenModal();
    } catch (error: any) {
        toast.add({
            title: '加载失败',
            description: error.data?.message || '无法加载令牌详情',
            color: 'error'
        });
    }
};

const handleConfirmDelete = (filename: string) => {
    tokenToDelete.value = filename;
    openDeleteModal();
};

const handleDeleteToken = async () => {
    deletingToken.value = true;
    try {
        await deleteToken(tokenToDelete.value);
        closeDeleteModal();
    } catch (error: any) {
        toast.add({
            title: '删除失败',
            description: error.data?.message || '无法删除令牌',
            color: 'error'
        });
    } finally {
        deletingToken.value = false;
    }
};

const resetNewTokenForm = () => {
    newTokenForm.value = {
        project: currentProject.value,
        type: 'session',
        loginMethod: 'email',
        identifier: '',
        password: '',
        token: '',
        device_id: ''
    };
};

const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
        router.push('/admin/login');
    }
};

// Initialize
onMounted(() => {
    loadProjects();
    loadTokens();
});

// Watch project change
watch(currentProject, () => {
    loadTokens();
});
</script>
