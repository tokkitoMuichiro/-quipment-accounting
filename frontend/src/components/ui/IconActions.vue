<template>
  <div class="icon-actions">
    <button
      v-if="canEdit"
      type="button"
      class="icon-btn"
      aria-label="Редактировать"
      title="Редактировать"
      @click.stop="$emit('edit')"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
        />
      </svg>
    </button>
    <button
      v-if="canDelete"
      type="button"
      class="icon-btn icon-btn--danger"
      aria-label="Удалить"
      title="Удалить"
      @click.stop="$emit('remove')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
        />
      </svg>
    </button>
  </div>
</template>

<script setup>
import './styles/IconActions.scss';

defineProps({
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
});
defineEmits(['edit', 'remove']);
</script>
