<template>
    <UModal v-model:open="open">
        <template #content>
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold">令牌详情</h3>
                </template>

                <div v-if="tokenData" class="space-y-3">
                    <div v-for="(value, key) in tokenData" :key="key"
                        class="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <p class="text-sm text-gray-500">{{ key }}</p>
                        <p class="font-mono text-sm break-all">{{ value }}</p>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end">
                        <UButton color="neutral" @click="$emit('close')">
                            关闭
                        </UButton>
                    </div>
                </template>
            </UCard>
        </template>
    </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true });

defineProps<{
    tokenData: any;
}>();

defineEmits<{
    close: [];
}>();
</script>
