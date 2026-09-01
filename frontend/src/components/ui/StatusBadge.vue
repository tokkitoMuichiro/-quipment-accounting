<template>
  <span class="badge" :class="cls" :title="note || undefined">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue';
import './styles/StatusBadge.scss';
import { CONDITION_LABEL } from '../../utils/format';

const props = defineProps({
  value: { type: String, required: true },
  note: { type: String, default: '' },
});

const map = {
  OK: 'badge--ok',
  NEEDS_REPAIR: 'badge--warn',
  IN_REPAIR: 'badge--repair',
  IRREPARABLE: 'badge--bad badge--tight',
};

const label = computed(() => CONDITION_LABEL[props.value] || props.value);
const cls = computed(() => map[props.value] || '');
</script>
