<template>
  <section>
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template v-if="userId" #actions>
        <button type="button" class="btn btn--ghost people-back-btn" @click="backToPeople">
          К списку сотрудников
        </button>
      </template>
    </PageHeader>

    <p v-if="error" class="alert">{{ error }}</p>

    <template v-if="!userId">
      <p v-if="usersLoading" class="muted">Загрузка сотрудников…</p>
      <div v-else-if="peopleWithEquipment.length" class="card table-wrap">
        <table class="eq-table people-table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Роль</th>
              <th>Позиций</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in peopleWithEquipment"
              :key="u.id"
              class="people-row"
              @click="selectUser(u.id)"
            >
              <td data-label="Сотрудник"><strong>{{ u.fullName }}</strong></td>
              <td data-label="Роль">{{ u.role?.name || '—' }}</td>
              <td data-label="Позиций">{{ equipmentCountLabel(u) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!usersLoading" class="empty card">
        Пока ни у кого нет закреплённых позиций в этом разделе.
      </p>
    </template>

    <template v-else>
      <div class="filters people-filters">
        <div class="people-filters__who">
          <span class="people-filters__label">Сотрудник:</span>
          <strong>{{ selectedUserName }}</strong>
        </div>
        <input v-model="query" :placeholder="searchPlaceholder" />
        <select v-if="category === 'EQUIPMENT'" v-model="condition" aria-label="Состояние">
          <option value="">Все состояния</option>
          <option v-for="opt in CONDITION_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <FilterMenu v-else :count="activeFilterCount" @reset="resetFilters">
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
        @updated="onEquipmentUpdated"
      />
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
      :category="category"
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
import { useDocsSyncStore } from '../stores/docsSync';
import { useSelection } from '../composables/useSelection';
import { useItemFilters } from '../composables/useItemFilters';
import { canTransferItem } from '../utils/access';
import {
  CARD_KIND_OPTIONS,
  CONDITION_OPTIONS,
  VEHICLE_KIND_OPTIONS,
  categoryFromRoute,
  categoryQueryParam,
} from '../utils/format';
import PageHeader from '../components/ui/PageHeader.vue';
import SelectionBar from '../components/ui/SelectionBar.vue';
import EquipmentBoard from '../components/equipment/EquipmentBoard.vue';
import EquipmentForm from '../components/equipment/EquipmentForm.vue';
import TransferModal from '../components/equipment/TransferModal.vue';
import FilterMenu from '../components/equipment/FilterMenu.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const docsSync = useDocsSyncStore();
const users = ref([]);
const items = ref([]);
const error = ref('');
const loading = ref(false);
const usersLoading = ref(false);
const userId = ref(route.query.userId || '');
const editItem = ref(null);
const transferItems = ref([]);
const category = computed(() => categoryFromRoute(route.meta.category));

const pageTitle = computed(() => {
  if (userId.value) {
    if (category.value === 'VEHICLE') return 'Транспорт сотрудника';
    if (category.value === 'CARD') return 'Карты сотрудника';
    return 'Оборудование сотрудника';
  }
  return route.meta.title || 'У сотрудников';
});

const pageSubtitle = computed(() => {
  if (userId.value) {
    return selectedUserName.value;
  }
  if (category.value === 'VEHICLE') return 'Сотрудники с закреплённым транспортом';
  if (category.value === 'CARD') return 'Сотрудники с закреплёнными картами';
  return 'Сотрудники с закреплённым оборудованием — откройте строку, чтобы увидеть список';
});

const peopleWithEquipment = computed(() =>
  users.value
    .filter((u) => (u._count?.equipment ?? 0) > 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
);

const selectedUserName = computed(
  () => users.value.find((u) => u.id === userId.value)?.fullName || 'Сотрудник',
);

const {
  query,
  condition,
  vehicleKind,
  cardKind,
  filtered,
  activeFilterCount,
  emptyText,
  resetFilters,
} = useItemFilters({ itemsRef: items, categoryRef: category });

const searchPlaceholder = computed(() =>
  category.value === 'VEHICLE'
    ? 'Поиск по названию или госномеру'
    : 'Поиск по названию или номеру',
);

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

function backToPeople() {
  selectUser('');
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    users.value = await fetchUsers(categoryQueryParam(category.value));
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
    const params = new URLSearchParams({
      ownerUserId: userId.value,
      category: categoryQueryParam(category.value),
    });
    items.value = await fetchEquipment(`?${params.toString()}`);
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
  resetFilters();
  load();
});

watch(
  () => docsSync.nonce,
  () => load(),
);

watch(category, async () => {
  userId.value = '';
  await loadUsers();
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
