<template>
    <UModal v-model:open="open">
        <template #content>
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold text-red-600">确认删除</h3>
                </template>

                <p>确定要删除令牌 <span class="font-mono break-all">{{ tokenName }}</span> 吗？此操作不可恢复。</p>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <UButton color="neutral" variant="ghost" @click="$emit('cancel')">
                            取消
                        </UButton>
                        <UButton color="error" @click="$emit('confirm')" :loading="loading">
                            删除
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
    tokenName: string;
    loading: boolean;
}>();

defineEmits<{
    confirm: [];
    cancel: [];
}>();
</script>
