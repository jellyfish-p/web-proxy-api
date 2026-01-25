<template>
    <UCard>
        <template #header>
            <h2 class="text-xl font-semibold">项目列表</h2>
        </template>

        <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl" />
        </div>

        <div v-else-if="projects.length === 0" class="text-center py-8 text-gray-500">
            暂无启用的项目
        </div>

        <div v-else class="space-y-4">
            <div v-for="project in projects" :key="project.name"
                class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"
                @click="$emit('select', project.name)">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-semibold text-lg">{{ project.name }}</h3>
                        <p class="text-sm text-gray-500">状态:
                            <span class="text-green-600 dark:text-green-400">已启用</span>
                        </p>
                    </div>
                    <UButton color="primary" variant="soft" icon="i-heroicons-arrow-right">
                        管理令牌
                    </UButton>
                </div>
            </div>
        </div>
    </UCard>
</template>

<script setup lang="ts">
import type { Project } from '~/composables/useProjects';

defineProps<{
    projects: Project[];
    loading: boolean;
}>();

defineEmits<{
    select: [projectName: string];
}>();
</script>
