<template>
  <AppModal :title="title" :hint="hint" @close="$emit('close')">
    <form class="form-grid" @submit.prevent="submit">
      <ul v-if="list.length > 1" class="muted transfer-list">
        <li v-for="entry in list" :key="entry.id">
          {{ entry.name }}
          <span v-if="entry.factoryNumber" class="mono">{{ entry.factoryNumber }}</span>
          × {{ entry.quantity }}
        </li>
      </ul>
      <label>
        Куда
        <select v-model="form.toOwnerType">
          <option value="USER">Сотруднику</option>
          <option value="WAREHOUSE">На производственную базу</option>
        </select>
      </label>
      <label v-if="form.toOwnerType === 'USER'">
        Сотрудник
        <select v-model="form.toUserId" required>
          <option disabled value="">Выберите</option>
          <option v-for="u in people" :key="u.id" :value="u.id">{{ u.fullName }}</option>
        </select>
      </label>
      <label v-else>
        Производственная база
        <select v-model="form.toWarehouseId" required>
          <option disabled value="">Выберите</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </label>
      <label v-if="list.length === 1 && list[0].type === 'CONSUMABLE'">
        Количество
        <input v-model.number="form.quantity" type="number" min="1" :max="list[0].quantity" required />
      </label>
      <p v-else-if="list.length > 1" class="muted">
        Неномерное в массовой передаче уходит целиком.
      </p>
      <p v-if="error" class="alert">{{ error }}</p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn--accent" :disabled="saving">
          {{ saving ? 'Передача…' : 'Передать' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import './styles/TransferModal.scss';
import AppModal from '../ui/AppModal.vue';
import { fetchUsers, fetchWarehouses } from '../../api/catalog';
import { bulkTransferEquipment, transferEquipment } from '../../api/equipment';

const props = defineProps({
  item: { type: Object, default: null },
  items: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'saved']);

const list = computed(() => (props.items.length ? props.items : props.item ? [props.item] : []));
const title = computed(() =>
  list.value.length > 1 ? `Передать ${list.value.length} позиций` : `Передать: ${list.value[0]?.name || ''}`,
);
const hint = computed(() =>
  form.toOwnerType === 'USER'
    ? 'Сотрудник должен нажать «Принять» по каждой позиции. До этого оборудование остаётся у вас в статусе «Ждёт принятия».'
    : 'На производственную базу оборудование переходит сразу.',
);

const people = ref([]);
const warehouses = ref([]);
const saving = ref(false);
const error = ref('');
const form = reactive({
  toOwnerType: 'USER',
  toUserId: '',
  toWarehouseId: '',
  quantity: list.value[0]?.quantity || 1,
});

onMounted(async () => {
  people.value = await fetchUsers();
  warehouses.value = await fetchWarehouses();
});

async function submit() {
  saving.value = true;
  error.value = '';
  const payload = {
    toOwnerType: form.toOwnerType,
    toUserId: form.toOwnerType === 'USER' ? form.toUserId : undefined,
    toWarehouseId: form.toOwnerType === 'WAREHOUSE' ? form.toWarehouseId : undefined,
  };
  try {
    if (list.value.length === 1) {
      const item = list.value[0];
      await transferEquipment(item.id, {
        ...payload,
        quantity: item.type === 'CONSUMABLE' ? form.quantity : 1,
      });
    } else {
      const result = await bulkTransferEquipment({
        ids: list.value.map((item) => item.id),
        ...payload,
      });
      if (result.failed?.length) {
        error.value = `Передано ${result.transferred}, ошибок: ${result.failed.length}`;
        if (result.transferred) emit('saved');
        return;
      }
    }
    emit('saved');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
