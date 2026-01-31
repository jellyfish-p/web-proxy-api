/**
 * 项目注册系统
 * 用于管理多个AI服务提供商的集成
 */

export interface ProjectHandler {
    // 处理聊天完成请求
    handleRequest: (params: {
        authToken: string;
        body: any;
    }) => Promise<{
        response: Response;
        state: any;
        session_id: string;
        model: string;
        [key: string]: any;
    }>;

    // 可选：自定义响应处理（流式/非流式）
    processResponse?: (params: {
        event: any;
        request: any;
        result: {
            response: Response;
            state: any;
            session_id: string;
            model: string;
            [key: string]: any;
        };
    }) => Promise<any>;
    
    // 释放资源（如账号）
    releaseResources?: (state: any) => void;
    
    // 获取支持的模型列表
    getSupportedModels: () => string[];
    
    // 项目名称
    name: string;
}

class ProjectRegistry {
    private projects: Map<string, ProjectHandler> = new Map();
    private modelToProject: Map<string, string> = new Map();

    /**
     * 注册一个新项目
     */
    register(projectId: string, handler: ProjectHandler) {
        if (this.projects.has(projectId)) {
            console.warn(`[ProjectRegistry] Project ${projectId} is already registered, overwriting...`);
        }
        
        this.projects.set(projectId, handler);
        
        // 注册模型映射
        const models = handler.getSupportedModels();
        for (const model of models) {
            const modelLower = model.toLowerCase();
            if (this.modelToProject.has(modelLower)) {
                console.warn(`[ProjectRegistry] Model ${model} is already registered to ${this.modelToProject.get(modelLower)}, overwriting with ${projectId}`);
            }
            this.modelToProject.set(modelLower, projectId);
        }
        
        console.log(`[ProjectRegistry] Registered project: ${handler.name} (${projectId}) with models: ${models.join(', ')}`);
    }

    /**
     * 根据模型名称获取对应的项目处理器
     */
    getHandlerByModel(model: string): ProjectHandler | null {
        const modelLower = model.toLowerCase();
        const projectId = this.modelToProject.get(modelLower);
        
        if (!projectId) {
            return null;
        }
        
        return this.projects.get(projectId) || null;
    }

    /**
     * 获取所有注册的项目
     */
    getAllProjects(): Array<{ id: string; handler: ProjectHandler }> {
        return Array.from(this.projects.entries()).map(([id, handler]) => ({ id, handler }));
    }

    /**
     * 获取所有支持的模型
     */
    getAllModels(): string[] {
        return Array.from(this.modelToProject.keys());
    }
}

// 单例实例
export const projectRegistry = new ProjectRegistry();
