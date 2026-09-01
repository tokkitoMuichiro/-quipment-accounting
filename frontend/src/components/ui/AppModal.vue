<template>
  <div class="modal-back" @click.self="$emit('close')">
    <div class="modal">
      <h3 v-if="title">{{ title }}</h3>
      <p v-if="hint" class="muted">{{ hint }}</p>
      <slot />
    </div>
  </div>
</template>

<script setup>
import './styles/AppModal.scss';

defineProps({
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
});
defineEmits(['close']);
</script>
