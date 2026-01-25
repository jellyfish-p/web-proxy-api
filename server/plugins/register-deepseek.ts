import { projectRegistry, type ProjectHandler } from '../utils/project-registry';
import { handleDeepSeekRequest, releaseDeepSeekAccount } from '../projects/deepseek/handler';

const deepseekHandler: ProjectHandler = {
    name: 'DeepSeek',
    
    getSupportedModels: () => [
        'deepseek-chat',
        'deepseek-reasoner',
        'deepseek-chat-search',
        'deepseek-reasoner-search'
    ],
    
    handleRequest: async (params) => {
        return await handleDeepSeekRequest(params);
    },
    
    releaseResources: (state) => {
        releaseDeepSeekAccount(state);
    }
};

export default defineNitroPlugin(() => {
    projectRegistry.register('deepseek', deepseekHandler);
    console.log('✓ DeepSeek project registered');
});
