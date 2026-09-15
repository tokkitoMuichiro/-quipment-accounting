import { computed, onMounted, ref, watch } from 'vue';
import { fetchEquipment, removeEquipment } from '../api/equipment';
import { useAuthStore } from '../stores/auth';
import { categoryQueryParam, searchBlob } from '../utils/format';

export function useEquipmentList({ scopeRef, warehouseIdRef, categoryRef } = {}) {
  const auth = useAuthStore();
  const items = ref([]);
  const query = ref('');
  const condition = ref('');
  const error = ref('');
  const loading = ref(false);

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    const isCard = categoryRef?.value === 'CARD';
    return items.value.filter((item) => {
      const okQuery = !q || searchBlob(item).includes(q);
      const okCond =
        isCard || !condition.value || item.condition === condition.value;
      return okQuery && okCond;
    });
  });

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
  onMounted(load);

  return {
    auth,
    items,
    filtered,
    query,
    condition,
    error,
    loading,
    load,
    removeItem,
  };
}
