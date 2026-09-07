<template>
  <section>
    <PageHeader
      title="Оборудование у сотрудников"
      subtitle="Выберите сотрудника, чтобы увидеть закреплённое за ним оборудование"
    />
    <div class="filters">
      <select v-model="userId" aria-label="Сотрудник">
        <option value="">Выберите сотрудника</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
      </select>
      <input
        v-model="query"
        :disabled="!userId"
        placeholder="Поиск по названию или номеру"
      />
      <select v-model="condition" :disabled="!userId">
        <option value="">Все состояния</option>
        <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <EquipmentBoard
      v-if="userId && !loading"
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
    <p v-if="!userId" class="empty card">Выберите сотрудника, чтобы открыть его список.</p>
    <SelectionBar
      :count="selectedItems.length"
      :can-transfer="canTransferSelected"
      @clear="clear"
      @transfer="openTransfer(selectedItems)"
    />
    <EquipmentForm
      v-if="editItem"
      :item="editItem"
      @close="editItem = null"
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchUsers } from '../api/catalog';
import { fetchEquipment, removeEquipment } from '../api/equipment';
import { useAuthStore } from '../stores/auth';
import { useSelection } from '../composables/useSelection';
import { canTransferItem } from '../utils/access';
import { CONDITION_OPTIONS } from '../utils/format';
import PageHeader from '../components/ui/PageHeader.vue';
import SelectionBar from '../components/ui/SelectionBar.vue';
import EquipmentBoard from '../components/equipment/EquipmentBoard.vue';
import EquipmentForm from '../components/equipment/EquipmentForm.vue';
import TransferModal from '../components/equipment/TransferModal.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const users = ref([]);
const items = ref([]);
const query = ref('');
const condition = ref('');
const error = ref('');
const loading = ref(false);
const userId = ref(route.query.userId || '');
const editItem = ref(null);
const transferItems = ref([]);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const text = `${item.name} ${item.factoryNumber || ''}`.toLowerCase();
    const okQuery = !q || text.includes(q);
    const okCond = !condition.value || item.condition === condition.value;
    return okQuery && okCond;
  });
});
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
const canSelect = computed(() => filtered.value.some((item) => canTransferItem(auth, item)));
const canTransferSelected = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.every((item) => canTransferItem(auth, item)),
);

async function loadUsers() {
  users.value = await fetchUsers();
}

async function load() {
  if (!userId.value) {
    items.value = [];
    loading.value = false;
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    items.value = await fetchEquipment(
      `?ownerUserId=${encodeURIComponent(userId.value)}`,
    );
  } catch (e) {
    error.value = e.message;
    items.value = [];
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

function openTransfer(list) {
  transferItems.value = list;
}

function onSaved() {
  editItem.value = null;
  transferItems.value = [];
  clear();
  load();
}

watch(userId, (id) => {
  const next = id ? { userId: id } : {};
  router.replace({ query: next });
  clear();
  load();
});

watch(filtered, () => {
  const visible = new Set(filtered.value.map((item) => item.id));
  selectedIds.value = selectedIds.value.filter((id) => visible.has(id));
});

onMounted(async () => {
  try {
    await loadUsers();
    await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
