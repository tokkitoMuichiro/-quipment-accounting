<template>
  <div class="upload-progress" role="status" aria-live="polite">
    <div class="upload-progress__head">
      <span class="upload-progress__name">{{ state.name }}</span>
      <span class="muted">{{ counter }} · {{ percent }}%</span>
    </div>
    <div class="upload-progress__track">
      <div class="upload-progress__bar" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import './styles/UploadProgress.scss';

const props = defineProps({
  state: { type: Object, required: true },
});

const percent = computed(() =>
  Math.min(100, Math.round((props.state.ratio || 0) * 100)),
);
const counter = computed(() => `${props.state.index} из ${props.state.total}`);
</script>
