<template>
  <section>
    <PageHeader title="История передач" subtitle="Журнал перемещений между мастерами и производственными базами" />
    <p v-if="error" class="alert">{{ error }}</p>
    <div class="card table-wrap stack-on-mobile history-table-wrap">
      <table v-if="rows.length" class="history-table">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Что</th>
            <th>Кол-во</th>
            <th>Откуда</th>
            <th>Куда</th>
            <th>Кто передал</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td data-label="Когда">{{ formatDate(row.createdAt) }}</td>
            <td data-label="Что">
              <strong>{{ row.equipmentName }}</strong>
              <div v-if="row.factoryNumber" class="muted mono">{{ row.factoryNumber }}</div>
            </td>
            <td data-label="Кол-во">{{ row.quantity }}</td>
            <td data-label="Откуда">{{ row.fromLabel }}</td>
            <td data-label="Куда">{{ row.toLabel }}</td>
            <td data-label="Кто передал">{{ row.actor?.fullName }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Передач ещё не было.</div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { fetchTransfers } from '../api/catalog';
import { formatDate } from '../utils/format';
import PageHeader from '../components/ui/PageHeader.vue';
import './styles/HistoryView.scss';

const rows = ref([]);
const error = ref('');

onMounted(async () => {
  try {
    rows.value = await fetchTransfers();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
