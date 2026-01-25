export const useModalState = () => {
    const showAddTokenModal = ref(false);
    const showViewTokenModal = ref(false);
    const showDeleteModal = ref(false);

    const openAddTokenModal = () => {
        showAddTokenModal.value = true;
    };

    const closeAddTokenModal = () => {
        showAddTokenModal.value = false;
    };

    const openViewTokenModal = () => {
        showViewTokenModal.value = true;
    };

    const closeViewTokenModal = () => {
        showViewTokenModal.value = false;
    };

    const openDeleteModal = () => {
        showDeleteModal.value = true;
    };

    const closeDeleteModal = () => {
        showDeleteModal.value = false;
    };

    return {
        showAddTokenModal,
        showViewTokenModal,
        showDeleteModal,
        openAddTokenModal,
        closeAddTokenModal,
        openViewTokenModal,
        closeViewTokenModal,
        openDeleteModal,
        closeDeleteModal
    };
};
