import { defineEventHandler } from 'h3';
import { projectRegistry } from '../../utils/project-registry';

export default defineEventHandler(async (event) => {
    const allModels = projectRegistry.getAllModels();
    const projects = projectRegistry.getAllProjects();
    
    const modelObjects = allModels.map(modelId => ({
        id: modelId,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "web-proxy-api"
    }));

    // 添加项目信息到响应头（可选）
    const projectInfo = projects.map(p => p.handler.name).join(', ');
    event.node.res.setHeader('X-Available-Projects', projectInfo);

    return {
        object: "list",
        data: modelObjects
    };
});
