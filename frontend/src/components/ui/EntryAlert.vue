<template>
  <div v-if="visible" class="entry-alert" role="status">
    <div class="entry-alert__body">
      <strong class="entry-alert__title">Требуется ваше внимание</strong>
      <ul class="entry-alert__list">
        <li v-if="alerts.pendingAccept > 0">
          Ожидают принятия:
          <strong>{{ alerts.pendingAccept }}</strong>
          {{ plural(alerts.pendingAccept, 'позиция', 'позиции', 'позиций') }}
        </li>
        <li v-if="alerts.needsFix > 0">
          Требуют исправления заполнения:
          <strong>{{ alerts.needsFix }}</strong>
          {{ plural(alerts.needsFix, 'позиция', 'позиции', 'позиций') }}
        </li>
        <li v-if="alerts.pendingReview > 0">
          Ожидают вашей проверки:
          <strong>{{ alerts.pendingReview }}</strong>
          {{ plural(alerts.pendingReview, 'позиция', 'позиции', 'позиций') }}
        </li>
      </ul>
      <div class="entry-alert__actions">
        <router-link
          v-if="alerts.pendingAccept > 0 || alerts.needsFix > 0"
          class="btn btn--small btn--accent"
          to="/mine"
          @click="dismiss"
        >
          Моё оборудование
        </router-link>
        <button type="button" class="btn btn--small btn--ghost" @click="dismiss">
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchEquipmentAlerts } from '../../api/equipment';
import './styles/EntryAlert.scss';

const alerts = ref({
  pendingAccept: 0,
  needsFix: 0,
  pendingReview: 0,
});
const closed = ref(false);

const visible = computed(() => {
  if (closed.value) return false;
  const a = alerts.value;
  return a.pendingAccept > 0 || a.needsFix > 0 || a.pendingReview > 0;
});

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function dismiss() {
  closed.value = true;
}

onMounted(async () => {
  try {
    alerts.value = await fetchEquipmentAlerts();
  } catch {
    // silent: banner is optional
  }
});
</script>
