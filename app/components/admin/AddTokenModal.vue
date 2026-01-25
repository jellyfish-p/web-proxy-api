<template>
    <UModal v-model:open="open">
        <template #content>
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold">添加令牌</h3>
                </template>

                <div class="space-y-4">
                    <UFormField label="项目">
                        <USelect :model-value="form.project" :items="projectOptions"
                            @update:model-value="updateField('project', $event)" />
                    </UFormField>

                    <UFormField label="类型">
                        <USelect :model-value="form.type" :items="[
                            { label: 'Session令牌', value: 'session' },
                            { label: '账号密码', value: 'password' }
                        ]" @update:model-value="updateField('type', $event)" />
                    </UFormField>

                    <!-- Session Type Fields -->
                    <template v-if="form.type === 'session'">
                        <UFormField label="Token" required>
                            <UTextarea :model-value="form.token" placeholder="输入session token"
                                @update:model-value="updateField('token', $event)" />
                        </UFormField>
                        <UFormField label="Device ID (可选)">
                            <UInput :model-value="form.device_id" placeholder="设备ID"
                                @update:model-value="updateField('device_id', $event)" />
                        </UFormField>
                    </template>

                    <!-- Password Type Fields -->
                    <template v-if="form.type === 'password'">
                        <UFormField label="登录方式">
                            <USelect :model-value="form.loginMethod" :items="[
                                { label: '邮箱', value: 'email' },
                                { label: '手机号', value: 'mobile' }
                            ]" @update:model-value="updateField('loginMethod', $event)" />
                        </UFormField>

                        <UFormField :label="form.loginMethod === 'email' ? '邮箱' : '手机号'" required>
                            <UInput :model-value="form.identifier"
                                :placeholder="form.loginMethod === 'email' ? '输入邮箱' : '输入手机号'"
                                @update:model-value="updateField('identifier', $event)" />
                        </UFormField>

                        <UFormField label="密码" required>
                            <UInput :model-value="form.password" type="password" placeholder="输入密码"
                                @update:model-value="updateField('password', $event)" />
                        </UFormField>

                        <UFormField label="Token (可选)">
                            <UTextarea :model-value="form.token" placeholder="如果已有token可填写"
                                @update:model-value="updateField('token', $event)" />
                        </UFormField>

                        <UFormField label="Device ID (可选)">
                            <UInput :model-value="form.device_id" placeholder="设备ID"
                                @update:model-value="updateField('device_id', $event)" />
                        </UFormField>
                    </template>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <UButton color="neutral" variant="ghost" @click="$emit('cancel')">
                            取消
                        </UButton>
                        <UButton color="primary" @click="$emit('submit')" :loading="loading">
                            添加
                        </UButton>
                    </div>
                </template>
            </UCard>
        </template>
    </UModal>
</template>

<script setup lang="ts">
export interface NewTokenForm {
    project: string;
    type: 'session' | 'password';
    loginMethod: 'email' | 'mobile';
    identifier: string;
    password: string;
    token: string;
    device_id: string;
}

const open = defineModel<boolean>('open', { required: true });
const form = defineModel<NewTokenForm>('form', { required: true });

defineProps<{
    projectOptions: Array<{ label: string; value: string }>;
    loading: boolean;
}>();

const emit = defineEmits<{
    submit: [];
    cancel: [];
}>();

const updateField = (field: keyof NewTokenForm, value: any) => {
    form.value = { ...form.value, [field]: value };
};
</script>
