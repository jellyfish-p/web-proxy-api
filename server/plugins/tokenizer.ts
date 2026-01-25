import { getTokenizer } from '../utils/tokenizer';

export default defineNitroPlugin(async (nitroApp) => {
    console.log('[Plugin] Initializing tokenizer...');
    
    try {
        await getTokenizer();
        console.log('[Plugin] Tokenizer initialized successfully');
    } catch (error) {
        console.error('[Plugin] Failed to initialize tokenizer:', error);
    }
});
