import { computed, ref } from 'vue';

export function useSelection(itemsRef) {
  const selectedIds = ref([]);

  const selectedSet = computed(() => new Set(selectedIds.value));

  const selectedItems = computed(() =>
    (itemsRef.value || []).filter((item) => selectedSet.value.has(item.id)),
  );

  const allSelected = computed(
    () =>
      (itemsRef.value || []).length > 0 &&
      (itemsRef.value || []).every((item) => selectedSet.value.has(item.id)),
  );

  const someSelected = computed(
    () => selectedIds.value.length > 0 && !allSelected.value,
  );

  function isSelected(id) {
    return selectedSet.value.has(id);
  }

  function toggle(id) {
    if (selectedSet.value.has(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  }

  function toggleAll() {
    if (allSelected.value) {
      selectedIds.value = [];
      return;
    }
    selectedIds.value = (itemsRef.value || []).map((item) => item.id);
  }

  function clear() {
    selectedIds.value = [];
  }

  return {
    selectedIds,
    selectedItems,
    allSelected,
    someSelected,
    isSelected,
    toggle,
    toggleAll,
    clear,
  };
}
