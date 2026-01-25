export default defineNuxtRouteMiddleware(async (to, from) => {
    // Skip middleware for login page
    if (to.path === '/admin/login') {
        return;
    }

    const { checkAuth, isAuthenticated } = useAuth();

    // Check authentication status
    const isAuth = await checkAuth();

    if (!isAuth && to.path.startsWith('/admin')) {
        return navigateTo('/admin/login');
    }
});
