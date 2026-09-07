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
          <th class="eq-col-serial">Заводской номер</th>
          <th class="eq-col-qty">Кол-во</th>
          <th class="eq-col-docs" title="Паспорта и сертификаты">Пасп.</th>
          <th class="eq-col-condition">Состояние</th>
          <th class="eq-col-owner">{{ showRepairSender ? 'Кто отправил' : 'Владелец' }}</th>
          <th class="eq-col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ 'is-selected': isSelected(item.id), 'is-pending': isPending(item) }">
          <td v-if="selectable" class="eq-col-check">
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
          </td>
          <td class="eq-col-serial mono" :title="item.factoryNumber || undefined">
            {{ item.factoryNumber || '—' }}
          </td>
          <td class="eq-col-qty">{{ item.quantity }}</td>
          <td class="eq-col-docs">
            <input
              :key="`${item.id}-docs-${docsNonce}`"
              class="checkbox"
              type="checkbox"
              :checked="Boolean(item.hasDocuments)"
              :disabled="!canEditDocs(item)"
              title="Паспорта и сертификаты"
              :aria-label="`Паспорта и сертификаты: ${item.name}`"
              @click.stop
              @change="$emit('documents-change', { item, hasDocuments: $event.target.checked })"
            />
          </td>
          <td class="eq-col-condition">
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
          <td class="eq-col-actions">
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
              <IconActions
                v-if="can('edit') || canDelete(item)"
                :can-edit="can('edit')"
                :can-delete="canDelete(item)"
                @edit="$emit('edit', item)"
                @remove="$emit('remove', item)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">Пока нет оборудования в этом списке.</div>
  </div>
</template>

<script setup>
import StatusBadge from '../ui/StatusBadge.vue';
import ConditionSelect from './ConditionSelect.vue';
import './styles/EquipmentTable.scss';
import IconActions from '../ui/IconActions.vue';
import { useAuthStore } from '../../stores/auth';
import { ownerLabel, pendingOfferLabel, repairSenderLabel, typeLabel } from '../../utils/format';
import {
  canAcceptTransfer,
  canCancelPendingTransfer,
  canChangeConditionItem,
  canDeleteItem,
  canEditDocumentsItem,
  canTransferItem,
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
defineEmits(['transfer', 'accept', 'cancel-pending', 'edit', 'remove', 'toggle', 'toggle-all', 'condition-change', 'documents-change']);

const auth = useAuthStore();
const can = auth.can;
const canTransfer = (item) => canTransferItem(auth, item);
const canAccept = (item) => canAcceptTransfer(auth, item);
const canCancel = (item) => canCancelPendingTransfer(auth, item);
const isPending = (item) => isPendingAccept(item);
const canChange = (item) => canChangeConditionItem(auth, item);
const canEditDocs = (item) => canEditDocumentsItem(auth, item);
const canDelete = (item) => canDeleteItem(auth, item);
</script>
