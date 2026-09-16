<template>
  <AppModal :title="modalTitle" @close="$emit('close')">
    <form class="form-grid" @submit.prevent="submit">
      <template v-if="category === 'EQUIPMENT'">
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
      </template>

      <template v-else-if="category === 'VEHICLE'">
        <label>
          Вид ТС
          <select v-model="form.vehicleKind" required>
            <option disabled value="">Выберите</option>
            <option v-for="opt in VEHICLE_KIND_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label>
          Госномер
          <input
            v-model="form.plateNumber"
            class="mono"
            required
            :placeholder="platePlaceholder(form.vehicleKind)"
          />
          <span class="muted">{{ plateHint(form.vehicleKind) }}</span>
        </label>
        <label>
          Наименование
          <input v-model="form.name" minlength="2" required />
        </label>
      </template>

      <template v-else>
        <label>
          Тип карты
          <select v-model="form.cardKind" required :disabled="Boolean(item)">
            <option disabled value="">Выберите</option>
            <option v-for="opt in CARD_KIND_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label v-if="form.cardKind === 'TRANSPONDER'">
          Наименование
          <input v-model="form.name" minlength="2" required />
        </label>
        <label>
          {{ form.cardKind === 'BUSINESS' ? 'Последние 4 цифры' : 'Номер' }}
          <input
            v-model="form.cardNumber"
            class="mono"
            required
            :minlength="form.cardKind === 'BUSINESS' ? 4 : 1"
            :maxlength="form.cardKind === 'BUSINESS' ? 4 : 64"
          />
        </label>
      </template>

      <template v-if="!item && category !== 'CARD'">
        <label>
          Состояние
          <ConditionSelect
            :model-value="form.condition"
            aria-label="Состояние"
            @change="form.condition = $event"
          />
        </label>
        <p v-if="form.condition === 'IN_REPAIR'" class="muted">
          Будет передано на базу «Ремонт».
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
        <DocumentDropzone
          v-if="supportsDocs"
          v-model:files="pendingFiles"
          :disabled="saving"
        />
      </template>

      <template v-if="!item && (category === 'CARD' || form.condition !== 'IN_REPAIR')">
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
import DocumentDropzone from './DocumentDropzone.vue';
import { canEditItemCard } from '../../utils/access';
import { fetchUsers, fetchWarehouses } from '../../api/catalog';
import { createEquipment, updateEquipment, uploadDocument } from '../../api/equipment';
import { useAuthStore } from '../../stores/auth';
import {
  CARD_KIND_OPTIONS,
  VEHICLE_KIND_OPTIONS,
  conditionNeedsNote,
} from '../../utils/format';
import { isValidPlate, plateHint, platePlaceholder } from '../../utils/plate';

const props = defineProps({
  item: { type: Object, default: null },
  category: { type: String, default: 'EQUIPMENT' },
  defaultOwnerType: { type: String, default: 'USER' },
  defaultWarehouseId: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);
const auth = useAuthStore();
const users = ref([]);
const warehouses = ref([]);
const saving = ref(false);
const error = ref('');
const pendingFiles = ref([]);
const canAssignAnyone = computed(
  () => auth.can('view_all') || auth.can('manage_warehouses') || auth.can('manage_roles'),
);
const category = computed(() => props.item?.category || props.category || 'EQUIPMENT');
const supportsDocs = computed(
  () => !props.item && (category.value === 'EQUIPMENT' || category.value === 'VEHICLE'),
);
const modalTitle = computed(() => {
  if (!props.item) {
    if (category.value === 'VEHICLE') return 'Новый транспорт';
    if (category.value === 'CARD') return 'Новая карта';
    return 'Новое оборудование';
  }
  if (props.item.fillStatus === 'NEEDS_FIX') return 'Исправить карточку';
  if (props.item.fillStatus === 'PENDING_REVIEW') return 'Дополнить карточку';
  return 'Изменить';
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
  plateNumber: '',
  vehicleKind: '',
  cardKind: '',
  cardNumber: '',
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
    form.plateNumber = item.plateNumber || '';
    form.vehicleKind = item.vehicleKind || '';
    form.cardKind = item.cardKind || '';
    form.cardNumber = item.cardNumber || '';
  },
  { immediate: true },
);

async function loadRefs() {
  users.value = await fetchUsers();
  warehouses.value = await fetchWarehouses();
}
loadRefs();

async function submit() {
  if (category.value === 'VEHICLE' && !isValidPlate(form.plateNumber, form.vehicleKind)) {
    error.value = `Неверный госномер. ${plateHint(form.vehicleKind)}`;
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    let created = null;
    if (props.item) {
      if (category.value === 'VEHICLE') {
        await updateEquipment(props.item.id, {
          name: form.name,
          plateNumber: form.plateNumber,
          vehicleKind: form.vehicleKind,
        });
      } else if (category.value === 'CARD') {
        await updateEquipment(props.item.id, {
          name: form.cardKind === 'TRANSPONDER' ? form.name : undefined,
          cardKind: form.cardKind,
          cardNumber: form.cardNumber,
        });
      } else {
        await updateEquipment(props.item.id, {
          name: form.name,
          type: form.type,
          factoryNumber: form.type === 'SERIAL' ? form.factoryNumber : '',
          quantity: form.type === 'CONSUMABLE' ? form.quantity : 1,
        });
      }
    } else if (category.value === 'VEHICLE') {
      created = await createEquipment({
        category: 'VEHICLE',
        name: form.name,
        plateNumber: form.plateNumber,
        vehicleKind: form.vehicleKind,
        condition: form.condition,
        conditionNote: needsNote.value ? form.conditionNote.trim() : null,
        ownerType: form.ownerType,
        ownerUserId: form.ownerType === 'USER' ? form.ownerUserId : undefined,
        ownerWarehouseId:
          form.ownerType === 'WAREHOUSE' ? form.ownerWarehouseId : undefined,
      });
    } else if (category.value === 'CARD') {
      created = await createEquipment({
        category: 'CARD',
        name: form.cardKind === 'TRANSPONDER' ? form.name : undefined,
        cardKind: form.cardKind,
        cardNumber: form.cardNumber,
        ownerType: form.ownerType,
        ownerUserId: form.ownerType === 'USER' ? form.ownerUserId : undefined,
        ownerWarehouseId:
          form.ownerType === 'WAREHOUSE' ? form.ownerWarehouseId : undefined,
      });
    } else {
      created = await createEquipment({
        category: 'EQUIPMENT',
        name: form.name,
        type: form.type,
        factoryNumber: form.type === 'SERIAL' ? form.factoryNumber : undefined,
        quantity: form.type === 'CONSUMABLE' ? form.quantity : 1,
        condition: form.condition,
        conditionNote: needsNote.value ? form.conditionNote.trim() : null,
        ownerType: form.ownerType,
        ownerUserId: form.ownerType === 'USER' ? form.ownerUserId : undefined,
        ownerWarehouseId:
          form.ownerType === 'WAREHOUSE' ? form.ownerWarehouseId : undefined,
      });
    }

    if (created?.id && pendingFiles.value.length) {
      const failed = [];
      for (const file of pendingFiles.value) {
        try {
          await uploadDocument(created.id, file);
        } catch (e) {
          failed.push(file.name);
          error.value = e.message;
        }
      }
      pendingFiles.value = [];
      if (failed.length) {
        error.value = `Позиция создана, но не загрузились: ${failed.join(', ')}. Можно добавить в карточке позиции.`;
        emit('saved');
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
