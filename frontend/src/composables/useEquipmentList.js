import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

export function useEquipmentList({ scopeRef, warehouseIdRef } = {}) {
  const auth = useAuthStore();
  const items = ref([]);
  const query = ref('');
  const condition = ref('');
  const error = ref('');
  const loading = ref(false);

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    return items.value.filter((item) => {
      const text = `${item.name} ${item.factoryNumber || ''}`.toLowerCase();
      const okQuery = !q || text.includes(q);
      const okCond = !condition.value || item.condition === condition.value;
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
      const qs = params.toString();
      items.value = await api(`/equipment${qs ? `?${qs}` : ''}`);
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function removeItem(item) {
    if (!confirm(`Удалить «${item.name}» из учёта?`)) return;
    try {
      await api(`/equipment/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      error.value = e.message;
    }
  }

  if (scopeRef) watch(scopeRef, load);
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
