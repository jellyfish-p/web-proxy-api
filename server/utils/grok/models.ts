export type GrokModelConfig = {
    grokModel: [string, string];
    rateLimitModel: string;
    cost: { type: string; multiplier: number; description: string };
    requiresSuper: boolean;
    displayName: string;
    description: string;
    rawModelPath: string;
    defaultTemperature: number;
    defaultMaxOutputTokens: number;
    supportedMaxOutputTokens: number;
    defaultTopP: number;
    isVideoModel?: boolean;
};

const MODEL_CONFIG: Record<string, GrokModelConfig> = {
    'grok-3-fast': {
        grokModel: ['grok-3', 'MODEL_MODE_FAST'],
        rateLimitModel: 'grok-3',
        cost: { type: 'low_cost', multiplier: 1, description: '计1次调用' },
        requiresSuper: false,
        displayName: 'Grok 3 Fast',
        description: 'Fast and efficient Grok 3 model',
        rawModelPath: 'xai/grok-3',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 8192,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4.1': {
        grokModel: ['grok-4-1-non-thinking-w-tool', 'MODEL_MODE_GROK_4_1'],
        rateLimitModel: 'grok-4-1-non-thinking-w-tool',
        cost: { type: 'low_cost', multiplier: 1, description: '计1次调用' },
        requiresSuper: false,
        displayName: 'Grok 4.1',
        description: 'Latest Grok 4.1 model with tool capabilities',
        rawModelPath: 'xai/grok-4-1-non-thinking-w-tool',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 8192,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4.1-thinking': {
        grokModel: ['grok-4-1-thinking-1108b', 'MODEL_MODE_AUTO'],
        rateLimitModel: 'grok-4-1-thinking-1108b',
        cost: { type: 'high_cost', multiplier: 1, description: '计1次调用' },
        requiresSuper: false,
        displayName: 'Grok 4.1 Thinking',
        description: 'Grok 4.1 model with advanced thinking and tool capabilities',
        rawModelPath: 'xai/grok-4-1-thinking-1108b',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 32768,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4-fast': {
        grokModel: ['grok-4-mini-thinking-tahoe', 'MODEL_MODE_GROK_4_MINI_THINKING'],
        rateLimitModel: 'grok-4-mini-thinking-tahoe',
        cost: { type: 'low_cost', multiplier: 1, description: '计1次调用' },
        requiresSuper: false,
        displayName: 'Grok 4 Fast',
        description: 'Fast version of Grok 4 with mini thinking capabilities',
        rawModelPath: 'xai/grok-4-mini-thinking-tahoe',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 8192,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4-fast-expert': {
        grokModel: ['grok-4-mini-thinking-tahoe', 'MODEL_MODE_EXPERT'],
        rateLimitModel: 'grok-4-mini-thinking-tahoe',
        cost: { type: 'high_cost', multiplier: 4, description: '计4次调用' },
        requiresSuper: false,
        displayName: 'Grok 4 Fast Expert',
        description: 'Expert mode of Grok 4 Fast with enhanced reasoning',
        rawModelPath: 'xai/grok-4-mini-thinking-tahoe',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 32768,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4-expert': {
        grokModel: ['grok-4', 'MODEL_MODE_EXPERT'],
        rateLimitModel: 'grok-4',
        cost: { type: 'high_cost', multiplier: 4, description: '计4次调用' },
        requiresSuper: false,
        displayName: 'Grok 4 Expert',
        description: 'Full Grok 4 model with expert mode capabilities',
        rawModelPath: 'xai/grok-4',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 32768,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-4-heavy': {
        grokModel: ['grok-4-heavy', 'MODEL_MODE_HEAVY'],
        rateLimitModel: 'grok-4-heavy',
        cost: { type: 'independent', multiplier: 1, description: '独立计费，只有Super用户可用' },
        requiresSuper: true,
        displayName: 'Grok 4 Heavy',
        description: 'Most powerful Grok 4 model with heavy computational capabilities. Requires Super Token for access.',
        rawModelPath: 'xai/grok-4-heavy',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 65536,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95
    },
    'grok-imagine-0.9': {
        grokModel: ['grok-3', 'MODEL_MODE_FAST'],
        rateLimitModel: 'grok-3',
        cost: { type: 'low_cost', multiplier: 1, description: '计1次调用' },
        requiresSuper: false,
        displayName: 'Grok Imagine 0.9',
        description: 'Image and video generation model. Supports text-to-image and image-to-video generation.',
        rawModelPath: 'xai/grok-imagine-0.9',
        defaultTemperature: 1.0,
        defaultMaxOutputTokens: 8192,
        supportedMaxOutputTokens: 131072,
        defaultTopP: 0.95,
        isVideoModel: true
    }
};

export const GrokModels = {
    getModelInfo(model: string): GrokModelConfig | null {
        return MODEL_CONFIG[model] || null;
    },
    isValidModel(model: string): boolean {
        return Boolean(MODEL_CONFIG[model]);
    },
    toGrok(model: string): [string, string] {
        const config = MODEL_CONFIG[model];
        return config ? config.grokModel : [model, 'MODEL_MODE_FAST'];
    },
    toRateLimit(model: string): string {
        const config = MODEL_CONFIG[model];
        return config ? config.rateLimitModel : model;
    },
    getAllModelNames(): string[] {
        return Object.keys(MODEL_CONFIG);
    }
};

export const GrokTokenTypes = {
    NORMAL: 'ssoNormal',
    SUPER: 'ssoSuper'
} as const;

export type GrokTokenType = typeof GrokTokenTypes[keyof typeof GrokTokenTypes];
