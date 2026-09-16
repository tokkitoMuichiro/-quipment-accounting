import { computed, ref, watch } from 'vue';
import { searchBlob } from '../utils/format';
import { normalizePlate } from '../utils/plate';

function matchesQuery(item, query) {
  if (!query) return true;
  if (searchBlob(item).includes(query)) return true;
  const plate = normalizePlate(item.plateNumber);
  return Boolean(plate) && plate.includes(normalizePlate(query));
}

/**
 * Search + category-aware filters shared by every equipment list.
 * Vehicles filter by kind and condition, cards by kind.
 */
export function useItemFilters({ itemsRef, categoryRef }) {
  const query = ref('');
  const condition = ref('');
  const vehicleKind = ref('');
  const cardKind = ref('');

  const activeFilterCount = computed(() => {
    const category = categoryRef?.value;
    if (category === 'CARD') return cardKind.value ? 1 : 0;
    let count = condition.value ? 1 : 0;
    if (category === 'VEHICLE' && vehicleKind.value) count += 1;
    return count;
  });

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    const category = categoryRef?.value;
    const isCard = category === 'CARD';
    return (itemsRef.value || []).filter((item) => {
      const okCondition =
        isCard || !condition.value || item.condition === condition.value;
      const okVehicleKind =
        category !== 'VEHICLE' ||
        !vehicleKind.value ||
        item.vehicleKind === vehicleKind.value;
      const okCardKind =
        !isCard || !cardKind.value || item.cardKind === cardKind.value;
      return (
        matchesQuery(item, q) && okCondition && okVehicleKind && okCardKind
      );
    });
  });

  const hasActiveSearch = computed(
    () => Boolean(query.value.trim()) || activeFilterCount.value > 0,
  );

  const emptyText = computed(() =>
    hasActiveSearch.value
      ? 'По текущему фильтру позиций нет.'
      : 'Пока нет позиций в этом списке.',
  );

  function resetFilters() {
    condition.value = '';
    vehicleKind.value = '';
    cardKind.value = '';
  }

  if (categoryRef) watch(categoryRef, resetFilters);

  return {
    query,
    condition,
    vehicleKind,
    cardKind,
    filtered,
    activeFilterCount,
    hasActiveSearch,
    emptyText,
    resetFilters,
  };
}
