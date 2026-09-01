<template>
  <div class="eq-cards eq-board__cards mobile-only">
    <label v-if="selectable && items.length" class="eq-card eq-card--select-all">
      <input
        class="checkbox"
        type="checkbox"
        :checked="allSelected"
        :indeterminate.prop="someSelected"
        @change="$emit('toggle-all')"
      />
      <strong>Выбрать все позиции</strong>
    </label>
    <article
      v-for="item in items"
      :key="item.id"
      class="eq-card"
      :class="{
        'is-selected': isSelected(item.id),
        'eq-card--no-mutate': !(can('edit') || can('delete')),
      }"
    >
      <div class="eq-card__head">
        <input
          v-if="selectable"
          class="checkbox"
          type="checkbox"
          :checked="isSelected(item.id)"
          :aria-label="`Выбрать ${item.name}`"
          @change="$emit('toggle', item.id)"
        />
        <div class="eq-card__title">
          <strong>{{ item.name }}</strong>
          <div class="muted">{{ typeLabel(item) }}</div>
        </div>
        <IconActions
          v-if="can('edit') || can('delete')"
          :can-edit="can('edit')"
          :can-delete="can('delete')"
          @edit="$emit('edit', item)"
          @remove="$emit('remove', item)"
        />
      </div>
      <div class="eq-card__meta">
        <span>Заводской номер <strong class="mono">{{ item.factoryNumber || '—' }}</strong></span>
        <span>Кол-во <strong>{{ item.quantity }}</strong></span>
        <label class="eq-card__docs" @click.stop>
          <input
            :key="`${item.id}-docs-${docsNonce}`"
            class="checkbox"
            type="checkbox"
            :checked="Boolean(item.hasDocuments)"
            :aria-label="`Паспорта и сертификаты: ${item.name}`"
            @change="$emit('documents-change', { item, hasDocuments: $event.target.checked })"
          />
          Паспорта и сертификаты
        </label>
        <span>
          Состояние
          <ConditionSelect
            v-if="canChange(item)"
            :key="`${item.id}-${item.condition}-${conditionNonce}`"
            :model-value="item.condition"
            :note="item.conditionNote"
            :aria-label="`Состояние ${item.name}`"
            @change="$emit('condition-change', { item, condition: $event })"
          />
          <StatusBadge v-else :value="item.condition" :note="item.conditionNote" />
        </span>
        <p v-if="item.conditionNote" class="eq-card__note">{{ item.conditionNote }}</p>
        <span>Владелец <strong>{{ ownerLabel(item) }}</strong></span>
      </div>
      <button
        v-if="canTransfer(item)"
        class="btn btn--small btn--accent eq-card__transfer"
        @click="$emit('transfer', item)"
      >
        Передать
      </button>
    </article>
    <div v-if="!items.length" class="empty card">Пока нет оборудования в этом списке.</div>
  </div>
</template>

<script setup>
import StatusBadge from '../ui/StatusBadge.vue';
import ConditionSelect from './ConditionSelect.vue';
import './styles/EquipmentCards.scss';
import IconActions from '../ui/IconActions.vue';
import { useAuthStore } from '../../stores/auth';
import { ownerLabel, typeLabel } from '../../utils/format';
import { canTransferItem, canChangeConditionItem } from '../../utils/access';

defineProps({
  items: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Function, default: () => false },
  allSelected: { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
  conditionNonce: { type: Number, default: 0 },
  docsNonce: { type: Number, default: 0 },
});
defineEmits(['transfer', 'edit', 'remove', 'toggle', 'toggle-all', 'condition-change', 'documents-change']);

const auth = useAuthStore();
const can = auth.can;
const canTransfer = (item) => canTransferItem(auth, item);
const canChange = (item) => canChangeConditionItem(auth, item);
</script>
