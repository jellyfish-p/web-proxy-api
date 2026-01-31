import { projectRegistry, type ProjectHandler } from '../utils/project-registry';
import { handleGrokRequest, handleGrokResponse } from '../projects/grok/handler';
import { GrokModels } from '../utils/grok/models';
import { configureGrokProxyPool } from '../utils/grok/proxy-pool';
import { initAccounts } from '../utils/grok/accounts';
import { startTokenRefreshService } from '../utils/grok/token-refresh';
import { getConfigValue } from '../utils/config';

const grokHandler: ProjectHandler = {
    name: 'Grok',
    getSupportedModels: () => GrokModels.getAllModelNames(),
    handleRequest: async (params) => {
        return await handleGrokRequest(params);
    },
    processResponse: async ({ request, result }) => {
        return handleGrokResponse({ response: result.response, state: result.state, model: result.model }, Boolean(request?.stream));
    }
};

export default defineNitroPlugin(async () => {
    const enabled = getConfigValue('projects.grok.enabled', false);
    if (!enabled) {
        console.log('[Grok] Project disabled in config');
        return;
    }

    await initAccounts();
    await configureGrokProxyPool();
    
    // Start automatic token refresh service
    startTokenRefreshService();
    
    projectRegistry.register('grok', grokHandler);
    console.log('✓ Grok project registered');
});
