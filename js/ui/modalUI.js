const elements = {
  saveBtn: document.getElementById("saveBtn"),
  deleteModal: document.getElementById("deleteModal"),
  deleteTermName: document.getElementById("deleteTermName"),
  deleteModalError: document.getElementById("deleteModalError"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  saveSuccessModal: document.getElementById("saveSuccessModal"),
  dismissSaveSuccessBtn: document.getElementById("dismissSaveSuccessBtn"),
  duplicateSaveModal: document.getElementById("duplicateSaveModal"),
  dismissDuplicateSaveBtn: document.getElementById("dismissDuplicateSaveBtn"),
  glossarySearch: document.getElementById("glossarySearch"),
};

export function initializeModalUI({ onConfirmDelete }) {
  let pendingDeleteItem = null;
  let deleteTrigger = null;

  function closeDeleteModal() {
    elements.deleteModal.hidden = true;
    elements.deleteModalError.hidden = true;
    pendingDeleteItem = null;
    if (deleteTrigger && deleteTrigger.isConnected) {
      deleteTrigger.focus();
    } else {
      elements.glossarySearch.focus();
    }
    deleteTrigger = null;
  }

  function closeSaveSuccessModal() {
    elements.saveSuccessModal.hidden = true;
    elements.saveBtn.focus();
  }

  function closeDuplicateSaveModal() {
    elements.duplicateSaveModal.hidden = true;
    elements.saveBtn.focus();
  }

  elements.cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  elements.deleteModal.addEventListener("click", (event) => {
    if (event.target === elements.deleteModal && !elements.confirmDeleteBtn.disabled) {
      closeDeleteModal();
    }
  });
  elements.deleteModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.confirmDeleteBtn.disabled) {
      event.preventDefault();
      closeDeleteModal();
      return;
    }
    if (event.key === "Tab") {
      const firstButton = elements.cancelDeleteBtn;
      const lastButton = elements.confirmDeleteBtn;
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    }
  });
  elements.confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteItem || elements.confirmDeleteBtn.disabled) return;
    const itemToDelete = pendingDeleteItem;
    elements.confirmDeleteBtn.disabled = true;
    elements.confirmDeleteBtn.textContent = "Menghapus...";
    elements.deleteModalError.hidden = true;
    try {
      await onConfirmDelete(itemToDelete);
      closeDeleteModal();
    } catch (error) {
      console.error("Delete Error:", error);
      elements.deleteModalError.hidden = false;
      elements.confirmDeleteBtn.disabled = false;
      elements.confirmDeleteBtn.textContent = "Ya, hapus";
    }
  });

  elements.dismissSaveSuccessBtn.addEventListener("click", closeSaveSuccessModal);
  elements.saveSuccessModal.addEventListener("click", (event) => {
    if (event.target === elements.saveSuccessModal) closeSaveSuccessModal();
  });
  elements.saveSuccessModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSaveSuccessModal();
  });

  elements.dismissDuplicateSaveBtn.addEventListener("click", closeDuplicateSaveModal);
  elements.duplicateSaveModal.addEventListener("click", (event) => {
    if (event.target === elements.duplicateSaveModal) closeDuplicateSaveModal();
  });
  elements.duplicateSaveModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDuplicateSaveModal();
  });

  return {
    openDeleteModal(item, trigger) {
      pendingDeleteItem = item;
      deleteTrigger = trigger;
      elements.deleteTermName.textContent = item.word;
      elements.deleteModalError.hidden = true;
      elements.confirmDeleteBtn.disabled = false;
      elements.confirmDeleteBtn.textContent = "Ya, hapus";
      elements.deleteModal.hidden = false;
      elements.cancelDeleteBtn.focus();
    },
    showSaveSuccess() {
      elements.saveSuccessModal.hidden = false;
      elements.dismissSaveSuccessBtn.focus();
    },
    showDuplicateSave() {
      elements.duplicateSaveModal.hidden = false;
      elements.dismissDuplicateSaveBtn.focus();
    },
  };
}
