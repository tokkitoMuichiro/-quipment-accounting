<template>
  <div
    class="modal-back"
    @click.self="onBackdrop"
  >
    <div
      ref="dialogRef"
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      tabindex="-1"
    >
      <h3 v-if="title" :id="titleId">{{ title }}</h3>
      <p v-if="hint" class="muted">{{ hint }}</p>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import './styles/AppModal.scss';

const props = defineProps({
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  /** Пока true — нельзя закрыть кликом снаружи или Escape. */
  locked: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

const dialogRef = ref(null);
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
let previousActive = null;

function requestClose() {
  if (props.locked) return;
  emit('close');
}

function onBackdrop() {
  requestClose();
}

function focusable() {
  const root = dialogRef.value;
  if (!root) return [];
  return [
    ...root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const nodes = focusable();
  if (!nodes.length) {
    event.preventDefault();
    dialogRef.value?.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  previousActive = document.activeElement;
  document.addEventListener('keydown', onKeydown);
  await nextTick();
  const nodes = focusable();
  (nodes[0] || dialogRef.value)?.focus();
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  if (previousActive && typeof previousActive.focus === 'function') {
    previousActive.focus();
  }
});
</script>
