import type { Ref } from 'vue';

export interface Project {
    name: string;
    enabled?: boolean;
}

export const useProjects = () => {
    const toast = useToast();
    
    const projects = ref<Project[]>([]);
    const projectsLoading = ref(false);
    const currentProject = ref('deepseek');

    const projectOptions = computed(() =>
        projects.value.map(p => ({ label: p.name, value: p.name }))
    );

    const loadProjects = async () => {
        projectsLoading.value = true;
        try {
            const response = await $fetch<any>('/api/v0/management/projects/list');
            projects.value = response.projects;
            if (projects.value.length > 0 && !currentProject.value && projects.value[0]) {
                currentProject.value = projects.value[0].name;
            }
        } catch (error: any) {
            toast.add({
                title: '加载失败',
                description: error.data?.message || '无法加载项目列表',
                color: 'error'
            });
        } finally {
            projectsLoading.value = false;
        }
    };

    const selectProject = (projectName: string) => {
        currentProject.value = projectName;
    };

    return {
        projects,
        projectsLoading,
        currentProject,
        projectOptions,
        loadProjects,
        selectProject
    };
};
