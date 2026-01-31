<template>
    <UCard>
        <template #header>
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-semibold">令牌管理</h2>
                    <p class="text-sm text-gray-500 mt-1">
                        当前项目: <span class="font-medium">{{ currentProject }}</span>
                    </p>
                </div>
                <UButton color="primary" icon="i-heroicons-plus" @click="$emit('add')">
                    添加令牌
                </UButton>
            </div>
        </template>

        <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl" />
        </div>

        <div v-else-if="tokens.length === 0" class="text-center py-8 text-gray-500">
            暂无令牌，点击上方按钮添加
        </div>

        <div v-else class="space-y-3">
            <div v-for="token in tokens" :key="token"
                class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center">
                <div class="flex-1">
                    <p class="font-mono text-sm">{{ token }}</p>
                </div>
                <div class="flex gap-2">
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-eye" size="sm"
                        @click="$emit('view', token)">
                        查看
                    </UButton>
                    <UButton color="error" variant="ghost" icon="i-heroicons-trash" size="sm"
                        @click="$emit('delete', token)">
                        删除
                    </UButton>
                </div>
            </div>
        </div>
    </UCard>
</template>

<script setup lang="ts">
defineProps<{
    tokens: string[];
    loading: boolean;
    currentProject: string;
}>();

defineEmits<{
    add: [];
    view: [token: string];
    delete: [token: string];
}>();
</script>
