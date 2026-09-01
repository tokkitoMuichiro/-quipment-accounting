<template>
  <div v-if="count" class="selection-bar">
    <div>
      <strong>Выбрано: {{ count }}</strong>
      <span class="selection-bar__hint">Можно передать одним действием</span>
    </div>
    <div class="toolbar">
      <button type="button" class="btn btn--ghost btn--ghost-on-dark" @click="$emit('clear')">
        Снять
      </button>
      <button
        v-if="canTransfer"
        type="button"
        class="btn btn--accent"
        @click="$emit('transfer')"
      >
        Передать
      </button>
    </div>
  </div>
</template>

<script setup>
import './styles/SelectionBar.scss';

defineProps({
  count: { type: Number, default: 0 },
  canTransfer: { type: Boolean, default: true },
});
defineEmits(['clear', 'transfer']);
</script>
