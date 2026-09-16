<template>
  <div class="card table-wrap eq-board__table desktop-only">
    <table v-if="items.length" class="eq-table">
      <thead>
        <tr>
          <th v-if="selectable" class="eq-col-check">
            <input
              class="checkbox"
              type="checkbox"
              :checked="allSelected"
              :indeterminate.prop="someSelected"
              aria-label="Выбрать все"
              @change="$emit('toggle-all')"
            />
          </th>
          <th class="eq-col-name">Наименование</th>
          <th class="eq-col-serial">
            <span v-if="category === 'VEHICLE'" class="eq-th-stack">Госномер</span>
            <span v-else-if="category === 'CARD'" class="eq-th-stack">Номер</span>
            <span v-else class="eq-th-stack">Заводской<br />номер</span>
          </th>
          <th v-if="category === 'EQUIPMENT'" class="eq-col-qty">
            <span class="eq-th-stack">Кол-во</span>
          </th>
          <th v-if="category !== 'CARD'" class="eq-col-docs" title="Паспорта и сертификаты">
            <span class="eq-th-stack">Пасп.<br />серт.</span>
          </th>
          <th v-if="category !== 'CARD'" class="eq-col-condition">
            <span class="eq-th-stack">Состояние</span>
          </th>
          <th class="eq-col-owner">
            <span v-if="showRepairSender" class="eq-th-stack">Кто<br />отправил</span>
            <span v-else class="eq-th-stack">Владелец</span>
          </th>
          <th class="eq-col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          class="eq-row--clickable"
          :class="{
            'is-selected': isSelected(item.id),
            'is-pending': isPending(item),
            'is-fill-fix': isNeedsFix(item),
            'is-fill-review': isPendingReview(item),
          }"
          @click="$emit('open', item)"
        >
          <td v-if="selectable" class="eq-col-check" @click.stop>
            <input
              class="checkbox"
              type="checkbox"
              :checked="isSelected(item.id)"
              :disabled="!canTransfer(item)"
              :aria-label="`Выбрать ${item.name}`"
              @change="$emit('toggle', item.id)"
            />
          </td>
          <td class="eq-col-name">
            <strong>{{ item.name }}</strong>
            <div class="muted">{{ typeLabel(item) }}</div>
            <div v-if="isNeedsFix(item) || isPendingReview(item)" class="eq-fill">
              <span
                class="badge"
                :class="isNeedsFix(item) ? 'badge--bad' : 'badge--warn'"
              >{{ FILL_STATUS_LABEL[item.fillStatus] }}</span>
              <div v-if="item.fillComment" class="eq-fill__comment">{{ item.fillComment }}</div>
            </div>
          </td>
          <td class="eq-col-serial mono" :title="identityLabel(item)">
            {{ identityLabel(item) }}
          </td>
          <td v-if="category === 'EQUIPMENT'" class="eq-col-qty">{{ item.quantity }}</td>
          <td v-if="category !== 'CARD'" class="eq-col-docs" @click.stop>
            <input
              class="checkbox"
              type="checkbox"
              :checked="Boolean(item.hasDocuments)"
              disabled
              title="Есть загруженные документы"
              :aria-label="`Паспорта и сертификаты: ${item.name}`"
            />
          </td>
          <td v-if="category !== 'CARD'" class="eq-col-condition" @click.stop>
            <ConditionSelect
              v-if="canChange(item)"
              :key="`${item.id}-${item.condition}-${conditionNonce}`"
              :model-value="item.condition"
              :note="item.conditionNote"
              :aria-label="`Состояние ${item.name}`"
              @change="$emit('condition-change', { item, condition: $event })"
            />
            <StatusBadge v-else :value="item.condition" :note="item.conditionNote" />
          </td>
          <td class="eq-col-owner">
            <template v-if="showRepairSender">
              {{ repairSenderLabel(item) || '—' }}
              <div v-if="item.sentToRepairFrom" class="muted">{{ item.sentToRepairFrom }}</div>
            </template>
            <template v-else>
              {{ ownerLabel(item) }}
            </template>
            <div v-if="isPending(item)" class="eq-pending">
              <span class="badge badge--pending">Ждёт принятия</span>
              <div class="muted">{{ pendingOfferLabel(item) }}</div>
            </div>
          </td>
          <td class="eq-col-actions" @click.stop>
            <div class="eq-row-actions">
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
                class="btn btn--small btn--accent"
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
              <IconActions
                v-if="canEditCard(item) || canDelete(item)"
                :can-edit="canEditCard(item)"
                :can-delete="canDelete(item)"
                @edit="$emit('edit', item)"
                @remove="$emit('remove', item)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import StatusBadge from '../ui/StatusBadge.vue';
import ConditionSelect from './ConditionSelect.vue';
import './styles/EquipmentTable.scss';
import IconActions from '../ui/IconActions.vue';
import { useAuthStore } from '../../stores/auth';
import {
  FILL_STATUS_LABEL,
  identityLabel,
  ownerLabel,
  pendingOfferLabel,
  repairSenderLabel,
  typeLabel,
} from '../../utils/format';
import {
  canAcceptTransfer,
  canCancelPendingTransfer,
  canChangeConditionItem,
  canConfirmFill,
  canDeleteItem,
  canEditItemCard,
  canFlagFill,
  canTransferItem,
  isFillNeedsFix,
  isFillPendingReview,
  isPendingAccept,
} from '../../utils/access';

defineProps({
  items: { type: Array, default: () => [] },
  category: { type: String, default: 'EQUIPMENT' },
  emptyText: { type: String, default: 'Пока нет позиций в этом списке.' },
  selectable: { type: Boolean, default: false },
  isSelected: { type: Function, default: () => false },
  allSelected: { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
  conditionNonce: { type: Number, default: 0 },
  showRepairSender: { type: Boolean, default: false },
});
defineEmits([
  'open',
  'transfer',
  'accept',
  'cancel-pending',
  'edit',
  'remove',
  'toggle',
  'toggle-all',
  'condition-change',
  'flag-fill',
  'confirm-fill',
]);

const auth = useAuthStore();
const canTransfer = (item) => canTransferItem(auth, item);
const canAccept = (item) => canAcceptTransfer(auth, item);
const canCancel = (item) => canCancelPendingTransfer(auth, item);
const isPending = (item) => isPendingAccept(item);
const canChange = (item) => canChangeConditionItem(auth, item);
const canDelete = (item) => canDeleteItem(auth, item);
const canEditCard = (item) => canEditItemCard(auth, item);
const canFlag = (item) => canFlagFill(auth, item);
const canConfirm = (item) => canConfirmFill(auth, item);
const isNeedsFix = (item) => isFillNeedsFix(item);
const isPendingReview = (item) => isFillPendingReview(item);
</script>
