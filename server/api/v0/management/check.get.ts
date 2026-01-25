import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    return {
        success: true,
        authenticated: true
    };
});
