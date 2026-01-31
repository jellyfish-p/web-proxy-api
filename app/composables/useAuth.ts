import { useState } from '#imports';

export const useAuth = () => {
    const isAuthenticated = useState('isAuthenticated', () => false);
    const isLoading = useState('authLoading', () => false);

    const checkAuth = async () => {
        try {
            isLoading.value = true;
            const response = await $fetch<{ authenticated: boolean }>('/api/v0/management/check', {
                method: 'GET'
            });
            isAuthenticated.value = response.authenticated;
            return response.authenticated;
        } catch (error) {
            isAuthenticated.value = false;
            return false;
        } finally {
            isLoading.value = false;
        }
    };

    const login = async (username: string, password: string) => {
        try {
            isLoading.value = true;
            const response = await $fetch<{ success: boolean; message: string }>('/api/v0/management/login', {
                method: 'POST',
                body: { username, password }
            });
            
            if (response.success) {
                isAuthenticated.value = true;
                return { success: true, message: response.message };
            } else {
                isAuthenticated.value = false;
                return {
                    success: false,
                    message: response.message || 'Login failed'
                };
            }
        } catch (error: any) {
            isAuthenticated.value = false;
            return {
                success: false,
                message: error.data?.message || 'Login failed'
            };
        } finally {
            isLoading.value = false;
        }
    };

    const logout = async () => {
        try {
            isLoading.value = true;
            await $fetch('/api/v0/management/logout', {
                method: 'POST'
            });
            isAuthenticated.value = false;
            return { success: true };
        } catch (error: any) {
            return { 
                success: false, 
                message: error.data?.message || 'Logout failed' 
            };
        } finally {
            isLoading.value = false;
        }
    };

    return {
        isAuthenticated,
        isLoading,
        checkAuth,
        login,
        logout
    };
};
