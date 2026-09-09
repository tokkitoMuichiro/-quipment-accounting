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
        'is-pending': isPending(item),
        'is-fill-fix': isNeedsFix(item),
        'is-fill-review': isPendingReview(item),
        'eq-card--no-mutate': !(canEditCard(item) || canDelete(item)),
      }"
    >
      <div class="eq-card__head">
        <input
          v-if="selectable"
          class="checkbox"
          type="checkbox"
          :checked="isSelected(item.id)"
          :disabled="!canTransfer(item)"
          :aria-label="`Выбрать ${item.name}`"
          @change="$emit('toggle', item.id)"
        />
        <div class="eq-card__title">
          <strong>{{ item.name }}</strong>
          <div class="muted">{{ typeLabel(item) }}</div>
          <div v-if="isNeedsFix(item) || isPendingReview(item)" class="eq-fill">
            <span
              class="badge"
              :class="isNeedsFix(item) ? 'badge--bad' : 'badge--warn'"
            >{{ FILL_STATUS_LABEL[item.fillStatus] }}</span>
            <div v-if="item.fillComment" class="eq-fill__comment">{{ item.fillComment }}</div>
          </div>
        </div>
        <IconActions
          v-if="canEditCard(item) || canDelete(item)"
          :can-edit="canEditCard(item)"
          :can-delete="canDelete(item)"
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
            :disabled="!canEditDocs(item)"
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
        <span v-if="showRepairSender">
          Кто отправил
          <strong>{{ repairSenderLabel(item) || '—' }}</strong>
        </span>
        <span v-else>Владелец <strong>{{ ownerLabel(item) }}</strong></span>
        <span v-if="showRepairSender && item.sentToRepairFrom" class="muted">
          Откуда <strong>{{ item.sentToRepairFrom }}</strong>
        </span>
        <span v-if="isPending(item)" class="eq-card__pending">
          <span class="badge badge--pending">Ждёт принятия</span>
          <strong>{{ pendingOfferLabel(item) }}</strong>
        </span>
      </div>
      <div
        v-if="canAccept(item) || canCancel(item) || canTransfer(item) || canFlag(item) || canConfirm(item)"
        class="eq-card__actions"
      >
        <button
          v-if="canAccept(item)"
          class="btn btn--small btn--accent"
          @click="$emit('accept', item)"
        >
          Принять
        </button>
        <button
          v-if="canCancel(item)"
          class="btn btn--small btn--ghost"
          @click="$emit('cancel-pending', item)"
        >
          Отменить
        </button>
        <button
          v-if="canTransfer(item)"
          class="btn btn--small btn--accent eq-card__transfer"
          @click="$emit('transfer', item)"
        >
          Передать
        </button>
        <button
          v-if="canFlag(item) && !isNeedsFix(item)"
          class="btn btn--small btn--ghost"
          @click="$emit('flag-fill', item)"
        >
          Замечание
        </button>
        <button
          v-if="canConfirm(item)"
          class="btn btn--small btn--accent"
          @click="$emit('confirm-fill', item)"
        >
          ОК
        </button>
      </div>
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
import { FILL_STATUS_LABEL, ownerLabel, pendingOfferLabel, repairSenderLabel, typeLabel } from '../../utils/format';
import {
  canAcceptTransfer,
  canCancelPendingTransfer,
  canChangeConditionItem,
  canConfirmFill,
  canDeleteItem,
  canEditDocumentsItem,
  canEditItemCard,
  canFlagFill,
  canTransferItem,
  isFillNeedsFix,
  isFillPendingReview,
  isPendingAccept,
} from '../../utils/access';

defineProps({
  items: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Function, default: () => false },
  allSelected: { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
  conditionNonce: { type: Number, default: 0 },
  docsNonce: { type: Number, default: 0 },
  showRepairSender: { type: Boolean, default: false },
});
defineEmits([
  'transfer',
  'accept',
  'cancel-pending',
  'edit',
  'remove',
  'toggle',
  'toggle-all',
  'condition-change',
  'documents-change',
  'flag-fill',
  'confirm-fill',
]);

const auth = useAuthStore();
const canTransfer = (item) => canTransferItem(auth, item);
const canAccept = (item) => canAcceptTransfer(auth, item);
const canCancel = (item) => canCancelPendingTransfer(auth, item);
const isPending = (item) => isPendingAccept(item);
const canChange = (item) => canChangeConditionItem(auth, item);
const canEditDocs = (item) => canEditDocumentsItem(auth, item) || canEditItemCard(auth, item);
const canDelete = (item) => canDeleteItem(auth, item);
const canEditCard = (item) => canEditItemCard(auth, item);
const canFlag = (item) => canFlagFill(auth, item);
const canConfirm = (item) => canConfirmFill(auth, item);
const isNeedsFix = (item) => isFillNeedsFix(item);
const isPendingReview = (item) => isFillPendingReview(item);
</script>
