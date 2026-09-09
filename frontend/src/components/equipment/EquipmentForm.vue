<template>
  <AppModal :title="modalTitle" @close="$emit('close')">
    <form class="form-grid" @submit.prevent="submit">
      <label>
        Наименование
        <input v-model="form.name" minlength="2" required />
      </label>
      <label>
        Тип
        <select v-model="form.type" :disabled="typeLocked">
          <option value="SERIAL">Серийное (заводской номер)</option>
          <option value="CONSUMABLE">Неномерное (количество)</option>
        </select>
      </label>
      <label v-if="form.type === 'SERIAL'">
        Заводской номер
        <input v-model="form.factoryNumber" class="mono" required />
      </label>
      <label v-else>
        Количество
        <input v-model.number="form.quantity" type="number" min="1" required />
      </label>
      <template v-if="!item">
        <label>
          Состояние
          <ConditionSelect
            :model-value="form.condition"
            aria-label="Состояние"
            @change="form.condition = $event"
          />
        </label>
        <p v-if="form.condition === 'IN_REPAIR'" class="muted">
          Оборудование будет передано на базу «Ремонт».
        </p>
        <label v-if="needsNote">
          Пояснение
          <textarea
            v-model="form.conditionNote"
            rows="3"
            required
            minlength="3"
            placeholder="Что случилось, что сломалось, причина"
          />
        </label>
        <label class="check-field">
          <input v-model="form.hasDocuments" type="checkbox" class="checkbox" />
          Есть паспорта и сертификаты
        </label>
        <template v-if="form.condition !== 'IN_REPAIR'">
          <label>
            Закрепить за
            <select v-model="form.ownerType">
              <option value="USER">Сотрудником</option>
              <option v-if="assignableWarehouses.length" value="WAREHOUSE">Производственной базой</option>
            </select>
          </label>
          <label v-if="form.ownerType === 'USER'">
            Сотрудник
            <select v-model="form.ownerUserId" required :disabled="!canAssignAnyone">
              <option disabled value="">Выберите</option>
              <option v-for="u in visibleUsers" :key="u.id" :value="u.id">{{ u.fullName }}</option>
            </select>
          </label>
          <label v-else>
            Производственная база
            <select v-model="form.ownerWarehouseId" required>
              <option disabled value="">Выберите</option>
              <option v-for="w in assignableWarehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>
        </template>
      </template>
      <p v-if="error" class="alert">{{ error }}</p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn--accent" :disabled="saving">Сохранить</button>
      </div>
    </form>
  </AppModal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import AppModal from '../ui/AppModal.vue';
import ConditionSelect from './ConditionSelect.vue';
import { canEditItemCard } from '../../utils/access';
import { fetchUsers, fetchWarehouses } from '../../api/catalog';
import { createEquipment, updateEquipment } from '../../api/equipment';
import { useAuthStore } from '../../stores/auth';
import { conditionNeedsNote } from '../../utils/format';

const props = defineProps({
  item: { type: Object, default: null },
  defaultOwnerType: { type: String, default: 'USER' },
  defaultWarehouseId: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);
const auth = useAuthStore();
const users = ref([]);
const warehouses = ref([]);
const saving = ref(false);
const error = ref('');
const canAssignAnyone = computed(
  () => auth.can('view_all') || auth.can('manage_warehouses') || auth.can('manage_roles'),
);
const modalTitle = computed(() => {
  if (!props.item) return 'Новое оборудование';
  if (props.item.fillStatus === 'NEEDS_FIX') return 'Исправить карточку';
  if (props.item.fillStatus === 'PENDING_REVIEW') return 'Дополнить карточку';
  return 'Изменить карточку';
});
const typeLocked = computed(
  () => Boolean(props.item) && !canEditItemCard(auth, props.item),
);
const needsNote = computed(() => conditionNeedsNote(form.condition));
const assignableWarehouses = computed(() => {
  const list = warehouses.value.filter((w) => !w.isSystem);
  if (canAssignAnyone.value) return list;
  const ids = auth.user?.warehouseIds || [];
  return list.filter((w) => ids.includes(w.id));
});

const form = reactive({
  name: '',
  type: 'SERIAL',
  factoryNumber: '',
  quantity: 1,
  condition: 'OK',
  conditionNote: '',
  hasDocuments: false,
  ownerType: props.defaultOwnerType,
  ownerUserId: auth.user?.id || '',
  ownerWarehouseId: props.defaultWarehouseId,
});

const visibleUsers = computed(() => {
  if (canAssignAnyone.value) return users.value;
  return users.value.filter((u) => u.id === auth.user?.id);
});

watch(
  () => props.item,
  (item) => {
    if (!item) return;
    form.name = item.name;
    form.type = item.type;
    form.factoryNumber = item.factoryNumber || '';
    form.quantity = item.quantity;
  },
  { immediate: true },
);

async function loadRefs() {
  users.value = await fetchUsers();
  warehouses.value = await fetchWarehouses();
}
loadRefs();

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    if (props.item) {
      await updateEquipment(props.item.id, {
        name: form.name,
        type: form.type,
        factoryNumber: form.type === 'SERIAL' ? form.factoryNumber : '',
        quantity: form.type === 'CONSUMABLE' ? form.quantity : 1,
      });
    } else {
      await createEquipment({
        name: form.name,
        type: form.type,
        factoryNumber: form.type === 'SERIAL' ? form.factoryNumber : undefined,
        quantity: form.type === 'CONSUMABLE' ? form.quantity : 1,
        condition: form.condition,
        conditionNote: needsNote.value ? form.conditionNote.trim() : null,
        hasDocuments: form.hasDocuments,
        ownerType: form.ownerType,
        ownerUserId: form.ownerType === 'USER' ? form.ownerUserId : undefined,
        ownerWarehouseId: form.ownerType === 'WAREHOUSE' ? form.ownerWarehouseId : undefined,
      });
    }
    emit('saved');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
