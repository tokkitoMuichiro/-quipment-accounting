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
        <option value="OK">Исправное</option>
        <option value="NEEDS_REPAIR">Требует ремонта</option>
        <option value="IN_REPAIR">В ремонте</option>
        <option value="IRREPARABLE">Не подлежит ремонту</option>
      </select>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <EquipmentBoard
      v-if="userId"
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
    <p v-else class="empty card">Выберите сотрудника, чтобы открыть его список.</p>
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
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useSelection } from '../composables/useSelection';
import { canTransferItem } from '../utils/access';
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
} = useSelection(filtered);
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
    return;
  }
  error.value = '';
  try {
    items.value = await api(`/equipment?ownerUserId=${encodeURIComponent(userId.value)}`);
  } catch (e) {
    error.value = e.message;
    items.value = [];
  }
}

async function removeItem(item) {
  if (!confirm(`Удалить «${item.name}» из учёта?`)) return;
  await api(`/equipment/${item.id}`, { method: 'DELETE' });
  await load();
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
