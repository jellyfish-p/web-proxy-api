export default defineNuxtRouteMiddleware(async (to) => {
    // Skip middleware for login page
    if (to.path === '/admin/login') {
        return;
    }

    const { checkAuth } = useAuth();

    // Check authentication status
    const isAuth = await checkAuth();

    if (!isAuth) {
        return navigateTo('/admin/login');
    }
});
