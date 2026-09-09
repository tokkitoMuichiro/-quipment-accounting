<template>
  <section>
    <PageHeader
      title="Оборудование у сотрудников"
      subtitle="Сотрудники с закреплённым оборудованием — откройте карточку, чтобы увидеть список"
    />

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="usersLoading" class="muted">Загрузка сотрудников…</p>

    <div v-else-if="peopleWithEquipment.length" class="people-tiles">
      <button
        v-for="u in peopleWithEquipment"
        :key="u.id"
        type="button"
        class="people-tile"
        :class="{ 'people-tile--active': userId === u.id }"
        @click="selectUser(u.id)"
      >
        <span class="people-tile__name">{{ u.fullName }}</span>
        <span class="people-tile__meta">
          <span v-if="u.role?.name" class="people-tile__role">{{ u.role.name }}</span>
          <span class="people-tile__count">{{ equipmentCountLabel(u) }}</span>
        </span>
      </button>
    </div>
    <p v-else-if="!usersLoading" class="empty card">
      Пока ни у кого нет закреплённого оборудования.
    </p>

    <template v-if="userId">
      <div class="filters people-filters">
        <div class="people-filters__who">
          <span class="people-filters__label">Сейчас:</span>
          <strong>{{ selectedUserName }}</strong>
          <button type="button" class="btn btn--small btn--ghost" @click="selectUser('')">
            Сбросить
          </button>
        </div>
        <input v-model="query" placeholder="Поиск по названию или номеру" />
        <select v-model="condition" aria-label="Состояние">
          <option value="">Все состояния</option>
          <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

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
        @updated="onEquipmentUpdated"
      />
      <p v-if="!loading && !filtered.length" class="empty card">
        У этого сотрудника нет позиций по текущему фильтру.
      </p>
    </template>

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
import './styles/PeopleEquipmentView.scss';
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
const usersLoading = ref(false);
const userId = ref(route.query.userId || '');
const editItem = ref(null);
const transferItems = ref([]);

const peopleWithEquipment = computed(() =>
  users.value
    .filter((u) => (u._count?.equipment ?? 0) > 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
);

const selectedUserName = computed(
  () => users.value.find((u) => u.id === userId.value)?.fullName || 'Сотрудник',
);

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
  () =>
    selectedItems.value.length > 0 &&
    selectedItems.value.every((item) => canTransferItem(auth, item)),
);

function equipmentCountLabel(u) {
  const n = u._count?.equipment ?? 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = 'позиций';
  if (mod10 === 1 && mod100 !== 11) word = 'позиция';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'позиции';
  return `${n} ${word}`;
}

function selectUser(id) {
  userId.value = id;
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    users.value = await fetchUsers();
  } finally {
    usersLoading.value = false;
  }
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
    await onEquipmentUpdated();
  } catch (e) {
    error.value = e.message;
  }
}

function openTransfer(list) {
  transferItems.value = list;
}

async function onEquipmentUpdated() {
  await Promise.all([load(), loadUsers()]);
}

async function onSaved() {
  editItem.value = null;
  transferItems.value = [];
  clear();
  await onEquipmentUpdated();
}

watch(userId, (id) => {
  const next = id ? { userId: id } : {};
  router.replace({ query: next });
  clear();
  query.value = '';
  condition.value = '';
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
