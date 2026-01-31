import { projectRegistry, type ProjectHandler } from '../utils/project-registry';
import { handleGrokRequest, handleGrokResponse } from '../projects/grok/handler';
import { GrokModels } from '../utils/grok/models';
import { configureGrokProxyPool } from '../utils/grok/proxy-pool';
import { grokTokenStore } from '../utils/grok/token-store';
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

    await grokTokenStore.ensureLoaded();
    await configureGrokProxyPool();
    projectRegistry.register('grok', grokHandler);
    console.log('✓ Grok project registered');
});
