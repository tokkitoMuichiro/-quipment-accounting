<template>
  <div>
    <EquipmentTable
      :items="items"
      :selectable="selectable"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      :condition-nonce="conditionNonce"
      :docs-nonce="docsNonce"
      @transfer="$emit('transfer', $event)"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      @toggle="$emit('toggle', $event)"
      @toggle-all="$emit('toggle-all')"
      @condition-change="onConditionChange"
      @documents-change="onDocumentsChange"
    />
    <EquipmentCards
      :items="items"
      :selectable="selectable"
      :is-selected="isSelected"
      :all-selected="allSelected"
      :some-selected="someSelected"
      :condition-nonce="conditionNonce"
      :docs-nonce="docsNonce"
      @transfer="$emit('transfer', $event)"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      @toggle="$emit('toggle', $event)"
      @toggle-all="$emit('toggle-all')"
      @condition-change="onConditionChange"
      @documents-change="onDocumentsChange"
    />
    <ConditionNoteModal
      v-if="pending"
      :item="pending.item"
      :condition="pending.condition"
      @close="cancelPending"
      @saved="onNoteSaved"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EquipmentTable from './EquipmentTable.vue';
import EquipmentCards from './EquipmentCards.vue';
import ConditionNoteModal from './ConditionNoteModal.vue';
import './styles/EquipmentBoard.scss';
import { updateEquipment } from '../../api/equipment';
import { useAuthStore } from '../../stores/auth';
import { canEditDocumentsItem } from '../../utils/access';

defineProps({
  items: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Function, default: () => false },
  allSelected: { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
});
const emit = defineEmits(['transfer', 'edit', 'remove', 'toggle', 'toggle-all', 'updated']);

const pending = ref(null);
const conditionNonce = ref(0);
const docsNonce = ref(0);
const auth = useAuthStore();

function bumpNonce() {
  conditionNonce.value += 1;
}

function bumpDocsNonce() {
  docsNonce.value += 1;
}

function onConditionChange({ item, condition }) {
  if (!item || condition === item.condition) return;
  pending.value = { item, condition };
}

async function onDocumentsChange({ item, hasDocuments }) {
  if (!item || Boolean(item.hasDocuments) === Boolean(hasDocuments)) {
    bumpDocsNonce();
    return;
  }
  if (!canEditDocumentsItem(auth, item)) {
    bumpDocsNonce();
    return;
  }
  const ok = window.confirm(
    hasDocuments
      ? `Отметить наличие паспортов и сертификатов у «${item.name}»?`
      : `Снять отметку о паспортах и сертификатах у «${item.name}»?`,
  );
  if (!ok) {
    bumpDocsNonce();
    return;
  }
  try {
    await updateEquipment(item.id, { hasDocuments });
    emit('updated');
  } catch (e) {
    bumpDocsNonce();
    window.alert(e.message);
  }
}

function cancelPending() {
  pending.value = null;
  bumpNonce();
}

function onNoteSaved() {
  pending.value = null;
  emit('updated');
}
</script>
