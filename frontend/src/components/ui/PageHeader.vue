<template>
  <div class="page-head">
    <div>
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="toolbar">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import './styles/PageHeader.scss';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});
</script>
