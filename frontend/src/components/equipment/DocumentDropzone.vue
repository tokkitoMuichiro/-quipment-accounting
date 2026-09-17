<template>
  <div
    class="doc-drop"
    :class="{ 'is-drag': dragging, 'is-disabled': disabled }"
    @dragenter.prevent="onDrag(true)"
    @dragover.prevent="onDrag(true)"
    @dragleave.prevent="onDrag(false)"
    @drop.prevent="onDrop"
  >
    <input
      ref="inputEl"
      type="file"
      class="doc-drop__input"
      multiple
      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      :disabled="disabled"
      @change="onPick"
    />
    <p class="doc-drop__title desktop-only">{{ title }}</p>
    <p class="muted doc-drop__hint desktop-only">{{ hint }}</p>
    <button
      type="button"
      class="btn btn--ghost btn--small doc-drop__pick"
      :disabled="disabled"
      @click="inputEl?.click()"
    >
      {{ buttonLabel }}
    </button>
    <p v-if="tooBig" class="alert doc-drop__alert">{{ tooBig }}</p>
    <ul v-if="files.length" class="doc-drop__list">
      <li v-for="(file, idx) in files" :key="`${file.name}-${file.size}-${idx}`">
        <span class="doc-drop__name">{{ file.name }}</span>
        <span class="muted doc-drop__size">{{ formatSize(file.size) }}</span>
        <button
          type="button"
          class="icon-btn icon-btn--danger doc-drop__remove"
          :disabled="disabled"
          aria-label="Убрать файл"
          title="Убрать файл"
          @click="removeAt(idx)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
            />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import './styles/DocumentDropzone.scss';
import { DOC_MAX_BYTES, DOC_MAX_LABEL } from '../../api/equipment';
import { formatSize } from '../../utils/format';

const props = defineProps({
  files: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: 'Паспорта и сертификаты' },
  buttonLabel: { type: String, default: 'Добавить документы' },
  hint: {
    type: String,
    default: `Перетащите файлы сюда или выберите с компьютера (PDF, JPG, PNG, DOC до ${DOC_MAX_LABEL})`,
  },
});

const emit = defineEmits(['update:files']);
const inputEl = ref(null);
const dragging = ref(false);
const tooBig = ref('');

function onDrag(value) {
  dragging.value = value;
}

function merge(incoming) {
  const list = Array.from(incoming || []).filter(Boolean);
  if (!list.length) return;
  const accepted = list.filter((file) => file.size <= DOC_MAX_BYTES);
  const rejected = list.filter((file) => file.size > DOC_MAX_BYTES);
  tooBig.value = rejected.length
    ? `Не добавлены (больше ${DOC_MAX_LABEL}): ${rejected.map((f) => f.name).join(', ')}`
    : '';
  if (!accepted.length) return;
  emit('update:files', [...props.files, ...accepted]);
}

function onPick(event) {
  merge(event.target.files);
  event.target.value = '';
}

function onDrop(event) {
  dragging.value = false;
  merge(event.dataTransfer?.files);
}

function removeAt(idx) {
  emit(
    'update:files',
    props.files.filter((_, i) => i !== idx),
  );
}
</script>
