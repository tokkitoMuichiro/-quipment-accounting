<template>
  <section>
    <PageHeader title="История передач" subtitle="Журнал перемещений между мастерами и производственными базами" />
    <div class="filters">
      <input
        v-model="query"
        type="search"
        placeholder="Поиск по названию или заводскому номеру"
        aria-label="Поиск по оборудованию"
      />
      <select v-model="actorId" aria-label="Сотрудник">
        <option value="">Все сотрудники</option>
        <option v-for="person in actors" :key="person.id" :value="person.id">
          {{ person.fullName }}
        </option>
      </select>
      <select v-model="dateOrder" aria-label="Сортировка по дате">
        <option value="desc">Сначала новые</option>
        <option value="asc">Сначала старые</option>
      </select>
    </div>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <div class="card table-wrap stack-on-mobile history-table-wrap">
      <table v-if="filtered.length" class="history-table">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Что</th>
            <th>Кол-во</th>
            <th>Откуда</th>
            <th>Куда</th>
            <th class="history-col-status">Статус</th>
            <th>Кто передал</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="row.id">
            <td data-label="Когда">{{ formatDate(row.createdAt) }}</td>
            <td data-label="Что">
              <strong>{{ row.equipmentName }}</strong>
              <div v-if="row.factoryNumber" class="muted mono">{{ row.factoryNumber }}</div>
            </td>
            <td data-label="Кол-во">{{ row.quantity }}</td>
            <td data-label="Откуда">{{ row.fromLabel }}</td>
            <td data-label="Куда">{{ row.toLabel }}</td>
            <td class="history-col-status" data-label="Статус">
              <span
                class="badge"
                :class="{
                  'badge--pending': row.status === 'PENDING',
                  'badge--ok': row.status === 'COMPLETED' || !row.status,
                  'badge--bad': row.status === 'CANCELLED',
                }"
              >{{ TRANSFER_STATUS_LABEL[row.status] || TRANSFER_STATUS_LABEL.COMPLETED }}</span>
            </td>
            <td data-label="Кто передал">{{ row.actor?.fullName }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="empty">
        {{ rows.length ? 'Нет записей по выбранным фильтрам.' : 'Передач ещё не было.' }}
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchTransfers } from '../api/catalog';
import { formatDate, TRANSFER_STATUS_LABEL } from '../utils/format';
import PageHeader from '../components/ui/PageHeader.vue';
import './styles/HistoryView.scss';

const rows = ref([]);
const error = ref('');
const loading = ref(false);
const query = ref('');
const actorId = ref('');
const dateOrder = ref('desc');

const actors = computed(() => {
  const map = new Map();
  for (const row of rows.value) {
    if (row.actor?.id && !map.has(row.actor.id)) {
      map.set(row.actor.id, {
        id: row.actor.id,
        fullName: row.actor.fullName || 'Сотрудник',
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'ru'),
  );
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = rows.value.filter((row) => {
    const text = `${row.equipmentName || ''} ${row.factoryNumber || ''}`.toLowerCase();
    const okQuery = !q || text.includes(q);
    const okActor = !actorId.value || row.actorUserId === actorId.value || row.actor?.id === actorId.value;
    return okQuery && okActor;
  });

  const direction = dateOrder.value === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    if (left === right) return 0;
    return left < right ? -direction : direction;
  });
});

onMounted(async () => {
  loading.value = true;
  try {
    rows.value = await fetchTransfers();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>
