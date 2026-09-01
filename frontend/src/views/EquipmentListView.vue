<template>
  <section>
    <PageHeader :title="title">
      <template #actions>
        <button v-if="auth.can('create')" class="btn btn--accent" @click="openCreate">Добавить</button>
      </template>
    </PageHeader>
    <div class="filters">
      <input v-model="query" placeholder="Поиск по названию или номеру" />
      <select v-model="condition">
        <option value="">Все состояния</option>
        <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <EquipmentBoard
      v-if="!loading"
      :items="filtered"
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
    <EquipmentForm
      v-if="showForm"
      :item="editItem"
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
import TransferModal from '../components/equipment/TransferModal.vue';
import { canTransferItem } from '../utils/access';
import { CONDITION_OPTIONS } from '../utils/format';

const route = useRoute();
const scope = computed(() => route.meta.scope || 'mine');
const {
  auth,
  filtered,
  query,
  condition,
  error,
  loading,
  load,
  removeItem,
} = useEquipmentList({ scopeRef: scope });

const {
  selectedItems,
  allSelected,
  someSelected,
  isSelected,
  toggle,
  toggleAll,
  clear,
  selectedIds,
} = useSelection(filtered);
const showForm = ref(false);
const editItem = ref(null);
const transferItems = ref([]);

const title = computed(() => route.meta.title || 'Оборудование');
const canSelect = computed(() => filtered.value.some((item) => canTransferItem(auth, item)));
const canTransferSelected = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.every((item) => canTransferItem(auth, item)),
);

function openCreate() {
  editItem.value = null;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editItem.value = null;
}

function openTransfer(items) {
  transferItems.value = items;
}

function onSaved() {
  closeForm();
  transferItems.value = [];
  clear();
  load();
}

watch(editItem, (v) => {
  if (v) showForm.value = true;
});

watch(filtered, () => {
  const visible = new Set(filtered.value.map((item) => item.id));
  selectedIds.value = selectedIds.value.filter((id) => visible.has(id));
});
</script>
