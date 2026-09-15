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
    <p class="doc-drop__title">{{ title }}</p>
    <p class="muted doc-drop__hint">{{ hint }}</p>
    <button
      type="button"
      class="btn btn--ghost btn--small"
      :disabled="disabled"
      @click="inputEl?.click()"
    >
      Выбрать файлы
    </button>
    <ul v-if="files.length" class="doc-drop__list">
      <li v-for="(file, idx) in files" :key="`${file.name}-${file.size}-${idx}`">
        <span class="doc-drop__name">{{ file.name }}</span>
        <button
          type="button"
          class="btn btn--ghost btn--small"
          :disabled="disabled"
          @click="removeAt(idx)"
        >
          Убрать
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import './styles/DocumentDropzone.scss';

const props = defineProps({
  files: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: 'Паспорта и сертификаты' },
  hint: {
    type: String,
    default: 'Перетащите файлы сюда или выберите с компьютера (PDF, JPG, PNG, DOC до 20 МБ)',
  },
});

const emit = defineEmits(['update:files']);
const inputEl = ref(null);
const dragging = ref(false);

function onDrag(value) {
  dragging.value = value;
}

function merge(incoming) {
  const list = Array.from(incoming || []).filter(Boolean);
  if (!list.length) return;
  emit('update:files', [...props.files, ...list]);
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
