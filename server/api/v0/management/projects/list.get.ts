import { requireAuth } from '../../../../utils/auth';
import { getConfigValue } from '../../../../utils/config';

export default defineEventHandler(async (event) => {
    requireAuth(event);

    const config = getConfigValue('projects', {});
    const projects = Object.keys(config).filter(key => config[key].enabled);

    return {
        success: true,
        projects: projects.map(name => ({
            name,
            enabled: config[name].enabled,
            ...config[name]
        }))
    };
});
