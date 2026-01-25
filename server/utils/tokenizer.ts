import { readFile } from 'fs/promises';
import { join } from 'path';

interface TokenizerConfig {
    version: string;
    added_tokens: Array<{
        id: number;
        content: string;
        special: boolean;
    }>;
    model?: {
        type: string;
        vocab?: Record<string, number>;
    };
}

class Tokenizer {
    private config: TokenizerConfig | null = null;
    private vocab: Map<string, number> = new Map();
    private initialized = false;

    async initialize() {
        if (this.initialized) return;

        try {
            const tokenizerPath = join(process.cwd(), 'server', 'assets', 'tokenizer.json');
            const content = await readFile(tokenizerPath, 'utf-8');
            this.config = JSON.parse(content);

            // Build vocabulary map
            if (this.config?.model?.vocab) {
                for (const [token, id] of Object.entries(this.config.model.vocab)) {
                    this.vocab.set(token, id);
                }
            }

            // Add special tokens
            if (this.config?.added_tokens) {
                for (const token of this.config.added_tokens) {
                    this.vocab.set(token.content, token.id);
                }
            }

            this.initialized = true;
            console.log('[Tokenizer] Initialized successfully');
        } catch (error) {
            console.error('[Tokenizer] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Estimate token count for text
     * This is a simplified estimation - for accurate counts, use a proper tokenizer library
     */
    estimateTokenCount(text: string): number {
        if (!text) return 0;

        // Simple estimation: ~4 characters per token for English, ~2 for Chinese
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const otherChars = text.length - chineseChars;

        const chineseTokens = Math.ceil(chineseChars / 2);
        const otherTokens = Math.ceil(otherChars / 4);

        return chineseTokens + otherTokens;
    }

    /**
     * Count tokens in messages array
     */
    countMessagesTokens(messages: Array<{ role: string; content: string | any[] }>): number {
        let totalTokens = 0;

        for (const message of messages) {
            // Add tokens for role markers
            totalTokens += 4; // Approximate overhead per message

            let content = '';
            if (Array.isArray(message.content)) {
                // Handle content array (multimodal)
                for (const item of message.content) {
                    if (item.type === 'text' && item.text) {
                        content += item.text;
                    }
                }
            } else {
                content = message.content || '';
            }

            totalTokens += this.estimateTokenCount(content);
        }

        return totalTokens;
    }

    /**
     * Get vocabulary size
     */
    getVocabSize(): number {
        return this.vocab.size;
    }

    /**
     * Check if tokenizer is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}

// Singleton instance
let tokenizerInstance: Tokenizer | null = null;

export async function getTokenizer(): Promise<Tokenizer> {
    if (!tokenizerInstance) {
        tokenizerInstance = new Tokenizer();
        await tokenizerInstance.initialize();
    }
    return tokenizerInstance;
}

export { Tokenizer };
