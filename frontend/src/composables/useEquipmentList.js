import { onMounted, ref, watch } from 'vue';
import { fetchEquipment, removeEquipment } from '../api/equipment';
import { useAuthStore } from '../stores/auth';
import { useDocsSyncStore } from '../stores/docsSync';
import { useItemFilters } from './useItemFilters';
import { categoryQueryParam } from '../utils/format';

export function useEquipmentList({ scopeRef, warehouseIdRef, categoryRef } = {}) {
  const auth = useAuthStore();
  const docsSync = useDocsSyncStore();
  const items = ref([]);
  const error = ref('');
  const loading = ref(false);
  const filters = useItemFilters({ itemsRef: items, categoryRef });

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const params = new URLSearchParams();
      if (scopeRef?.value === 'mine') params.set('scope', 'mine');
      if (warehouseIdRef?.value) params.set('warehouseId', warehouseIdRef.value);
      params.set(
        'category',
        categoryQueryParam(categoryRef?.value || 'EQUIPMENT'),
      );
      items.value = await fetchEquipment(`?${params.toString()}`);
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function removeItem(item) {
    if (!confirm(`Удалить «${item.name}» из учёта?`)) return;
    try {
      await removeEquipment(item.id);
      await load();
    } catch (e) {
      error.value = e.message;
    }
  }

  if (scopeRef) watch(scopeRef, load);
  if (categoryRef) watch(categoryRef, load);
  watch(
    () => docsSync.nonce,
    () => load(),
  );
  onMounted(load);

  return {
    auth,
    items,
    error,
    loading,
    load,
    removeItem,
    ...filters,
  };
}
