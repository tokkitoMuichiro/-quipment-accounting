<template>
  <section>
    <PageHeader :title="title">
      <template #actions>
        <button v-if="auth.can('create')" class="btn btn--accent" @click="openCreate">Добавить</button>
      </template>
    </PageHeader>
    <div class="filters">
      <input v-model="query" :placeholder="searchPlaceholder" />
      <select v-if="category === 'EQUIPMENT'" v-model="condition" aria-label="Состояние">
        <option value="">Все состояния</option>
        <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <FilterMenu
        v-else
        :count="activeFilterCount"
        @reset="resetFilters"
      >
        <label v-if="category === 'VEHICLE'">
          Вид транспорта
          <select v-model="vehicleKind">
            <option value="">Любой</option>
            <option v-for="opt in VEHICLE_KIND_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label v-if="category === 'VEHICLE'">
          Состояние
          <select v-model="condition">
            <option value="">Любое</option>
            <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label v-if="category === 'CARD'">
          Тип карты
          <select v-model="cardKind">
            <option value="">Любой</option>
            <option v-for="opt in CARD_KIND_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
      </FilterMenu>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <EquipmentBoard
      v-if="!loading"
      :items="filtered"
      :category="category"
      :empty-text="emptyText"
      :selectable="canSelect"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      @transfer="openTransfer([$event])"
      @edit="editItem = $event"
      @remove="removeItem"
      @toggle="toggle"
      @toggle-all="toggleAll"
      @updated="load"
    />
    <SelectionBar
      :count="selectedItems.length"
      :can-transfer="canTransferSelected"
      @clear="clear"
      @transfer="openTransfer(selectedItems)"
    />
    <AssetTypePicker
      v-if="showPicker"
      @close="showPicker = false"
      @pick="onPickCategory"
    />
    <EquipmentForm
      v-if="showForm"
      :item="editItem"
      :category="createCategory"
      @close="closeForm"
      @saved="onSaved"
    />
    <TransferModal
      v-if="transferItems.length"
      :items="transferItems"
      @close="transferItems = []"
      @saved="onSaved"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useEquipmentList } from '../composables/useEquipmentList';
import { useSelection } from '../composables/useSelection';
import PageHeader from '../components/ui/PageHeader.vue';
import SelectionBar from '../components/ui/SelectionBar.vue';
import EquipmentBoard from '../components/equipment/EquipmentBoard.vue';
import EquipmentForm from '../components/equipment/EquipmentForm.vue';
import AssetTypePicker from '../components/equipment/AssetTypePicker.vue';
import TransferModal from '../components/equipment/TransferModal.vue';
import FilterMenu from '../components/equipment/FilterMenu.vue';
import { canTransferItem } from '../utils/access';
import {
  CARD_KIND_OPTIONS,
  CONDITION_OPTIONS,
  VEHICLE_KIND_OPTIONS,
  categoryFromRoute,
} from '../utils/format';

const route = useRoute();
const scope = computed(() => route.meta.scope || 'mine');
const category = computed(() => categoryFromRoute(route.meta.category));
const {
  auth,
  filtered,
  query,
  condition,
  vehicleKind,
  cardKind,
  activeFilterCount,
  emptyText,
  resetFilters,
  error,
  loading,
  load,
  removeItem,
} = useEquipmentList({ scopeRef: scope, categoryRef: category });

const {
  selectedItems,
  allSelected,
  someSelected,
  isSelected,
  toggle,
  toggleAll,
  clear,
  selectedIds,
} = useSelection(filtered, (item) => canTransferItem(auth, item));
const showPicker = ref(false);
const showForm = ref(false);
const editItem = ref(null);
const createCategory = ref('EQUIPMENT');
const transferItems = ref([]);

const title = computed(() => route.meta.title || 'Оборудование');
const searchPlaceholder = computed(() => {
  if (category.value === 'VEHICLE') return 'Поиск по названию или госномеру';
  if (category.value === 'CARD') return 'Поиск по названию или номеру';
  return 'Поиск по названию или номеру';
});
const canSelect = computed(() => filtered.value.some((item) => canTransferItem(auth, item)));
const canTransferSelected = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.every((item) => canTransferItem(auth, item)),
);

function openCreate() {
  editItem.value = null;
  showPicker.value = true;
}

function onPickCategory(cat) {
  createCategory.value = cat;
  showPicker.value = false;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editItem.value = null;
}

function openTransfer(items) {
  transferItems.value = items;
}

function onSaved(result) {
  if (!result?.keepOpen) {
    closeForm();
  }
  transferItems.value = [];
  clear();
  load();
}

watch(editItem, (v) => {
  if (v) {
    createCategory.value = v.category || 'EQUIPMENT';
    showForm.value = true;
  }
});

watch(filtered, () => {
  const visible = new Set(filtered.value.map((item) => item.id));
  selectedIds.value = selectedIds.value.filter((id) => visible.has(id));
});
</script>
