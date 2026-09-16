<template>
  <div>
    <EquipmentTable
      :items="items"
      :category="category"
      :empty-text="emptyText"
      :selectable="selectable"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      :condition-nonce="conditionNonce"
      :show-repair-sender="showRepairSender"
      @open="detailItem = $event"
      @transfer="$emit('transfer', $event)"
      @accept="onAccept"
      @cancel-pending="onCancelPending"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      @toggle="$emit('toggle', $event)"
      @toggle-all="$emit('toggle-all')"
      @condition-change="onConditionChange"
      @flag-fill="onFlagFill"
      @confirm-fill="onConfirmFill"
    />
    <EquipmentCards
      :items="items"
      :category="category"
      :empty-text="emptyText"
      :selectable="selectable"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      :condition-nonce="conditionNonce"
      :show-repair-sender="showRepairSender"
      @open="detailItem = $event"
      @transfer="$emit('transfer', $event)"
      @accept="onAccept"
      @cancel-pending="onCancelPending"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      @toggle="$emit('toggle', $event)"
      @toggle-all="$emit('toggle-all')"
      @condition-change="onConditionChange"
      @flag-fill="onFlagFill"
      @confirm-fill="onConfirmFill"
    />
    <ConditionNoteModal
      v-if="pending"
      :item="pending.item"
      :condition="pending.condition"
      @close="cancelPending"
      @saved="onNoteSaved"
    />
    <EquipmentDetailModal
      v-if="detailItem"
      :item="detailItem"
      @close="detailItem = null"
      @edit="onDetailEdit"
      @updated="onDetailUpdated"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EquipmentTable from './EquipmentTable.vue';
import EquipmentCards from './EquipmentCards.vue';
import ConditionNoteModal from './ConditionNoteModal.vue';
import EquipmentDetailModal from './EquipmentDetailModal.vue';
import './styles/EquipmentBoard.scss';
import { acceptTransfer, cancelPendingTransfer, confirmFill, flagFill } from '../../api/equipment';

defineProps({
  items: { type: Array, default: () => [] },
  category: { type: String, default: 'EQUIPMENT' },
  emptyText: { type: String, default: 'Пока нет позиций в этом списке.' },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Function, default: () => false },
  allSelected: { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
  showRepairSender: { type: Boolean, default: false },
});
const emit = defineEmits(['transfer', 'edit', 'remove', 'toggle', 'toggle-all', 'updated']);

const pending = ref(null);
const detailItem = ref(null);
const conditionNonce = ref(0);

function bumpNonce() {
  conditionNonce.value += 1;
}

function onConditionChange({ item, condition }) {
  if (!item || condition === item.condition) return;
  pending.value = { item, condition };
}

function cancelPending() {
  pending.value = null;
  bumpNonce();
}

function onDetailEdit(item) {
  detailItem.value = null;
  emit('edit', item);
}

function onDetailUpdated() {
  emit('updated');
}

async function onAccept(item) {
  if (!window.confirm(`Принять «${item.name}»?`)) return;
  try {
    await acceptTransfer(item.id);
    emit('updated');
  } catch (e) {
    window.alert(e.message);
  }
}

async function onCancelPending(item) {
  const to = item.pendingTransfer?.toLabel || 'получателю';
  if (!window.confirm(`Отменить передачу «${item.name}» — ${to}?`)) return;
  try {
    await cancelPendingTransfer(item.id);
    emit('updated');
  } catch (e) {
    window.alert(e.message);
  }
}

async function onFlagFill(item) {
  const comment = window.prompt(
    `Замечание по заполнению «${item.name}» (увидит владелец):`,
    item.fillComment || '',
  );
  if (comment == null) return;
  if (comment.trim().length < 3) {
    window.alert('Укажите комментарий не короче 3 символов');
    return;
  }
  try {
    await flagFill(item.id, comment.trim());
    emit('updated');
  } catch (e) {
    window.alert(e.message);
  }
}

async function onConfirmFill(item) {
  if (!window.confirm(`Подтвердить заполнение «${item.name}»?`)) return;
  try {
    await confirmFill(item.id);
    emit('updated');
  } catch (e) {
    window.alert(e.message);
  }
}

function onNoteSaved() {
  pending.value = null;
  emit('updated');
}
</script>
