<template>
  <section>
    <PageHeader
      :title="warehouse?.name || 'Производственная база'"
      :subtitle="warehouseSubtitle"
    >
      <template #actions>
        <router-link class="btn btn--ghost" to="/warehouses">Назад</router-link>
        <button v-if="canStock" class="btn btn--accent" @click="openCreate">
          Внести на базу
        </button>
      </template>
    </PageHeader>

    <div class="filters">
      <select v-model="categoryFilter" aria-label="Категория">
        <option value="EQUIPMENT">Оборудование</option>
        <option value="VEHICLE">Транспорт</option>
        <option value="CARD">Карты</option>
      </select>
    </div>

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <EquipmentBoard
      v-if="!loading"
      :items="items"
      :category="categoryFilter"
      :selectable="canSelect"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      :show-repair-sender="isRepairWarehouse"
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
      v-if="showForm || editItem"
      :item="editItem"
      :category="createCategory"
      default-owner-type="WAREHOUSE"
      :default-warehouse-id="id"
      @close="closeForm"
      @saved="reload"
    />
    <TransferModal
      v-if="transferItems.length"
      :items="transferItems"
      @close="transferItems = []"
      @saved="reload"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchWarehouse } from '../api/catalog';
import { removeEquipment } from '../api/equipment';
import { useAuthStore } from '../stores/auth';
import { useDocsSyncStore } from '../stores/docsSync';
import { useSelection } from '../composables/useSelection';
import PageHeader from '../components/ui/PageHeader.vue';
import SelectionBar from '../components/ui/SelectionBar.vue';
import EquipmentBoard from '../components/equipment/EquipmentBoard.vue';
import EquipmentForm from '../components/equipment/EquipmentForm.vue';
import AssetTypePicker from '../components/equipment/AssetTypePicker.vue';
import TransferModal from '../components/equipment/TransferModal.vue';
import { canTransferItem, canStockWarehouse } from '../utils/access';
import { categoryQueryParam } from '../utils/format';

const route = useRoute();
const auth = useAuthStore();
const docsSync = useDocsSyncStore();
const warehouse = ref(null);
const error = ref('');
const loading = ref(false);
const showPicker = ref(false);
const showForm = ref(false);
const editItem = ref(null);
const transferItems = ref([]);
const categoryFilter = ref('EQUIPMENT');
const createCategory = ref('EQUIPMENT');
const id = computed(() => route.params.id);
const items = computed(() => warehouse.value?.equipment || []);
const isRepairWarehouse = computed(() => warehouse.value?.slug === 'repair');
const warehouseSubtitle = computed(() => {
  if (isRepairWarehouse.value) return 'Кто отправил в ремонт';
  return warehouse.value?.address || 'Позиции на этой базе';
});
const {
  selectedItems,
  allSelected,
  someSelected,
  isSelected,
  toggle,
  toggleAll,
  clear,
} = useSelection(items, (item) => canTransferItem(auth, item));
const canTransferSelected = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.every((item) => canTransferItem(auth, item)),
);
const canStock = computed(() => canStockWarehouse(auth, id.value));
const canSelect = computed(() => items.value.some((item) => canTransferItem(auth, item)));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    warehouse.value = await fetchWarehouse(
      id.value,
      categoryQueryParam(categoryFilter.value),
    );
  } catch (e) {
    warehouse.value = null;
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

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

async function reload() {
  closeForm();
  transferItems.value = [];
  clear();
  await load();
}

function openTransfer(list) {
  transferItems.value = list;
}

async function removeItem(item) {
  if (!confirm(`Удалить «${item.name}»?`)) return;
  try {
    await removeEquipment(item.id);
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

watch(editItem, (v) => {
  if (v) {
    createCategory.value = v.category || 'EQUIPMENT';
    showForm.value = true;
  }
});

watch(
  [id, categoryFilter],
  () => {
    clear();
    load();
  },
  { immediate: true },
);

watch(
  () => docsSync.nonce,
  () => load(),
);
</script>
