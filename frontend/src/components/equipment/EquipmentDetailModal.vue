<template>
  <AppModal
    :title="item?.name || 'Позиция'"
    hint="Документы хранятся в Битрикс"
    :locked="busy"
    @close="$emit('close')"
  >
    <div class="eq-detail form-grid">
      <dl class="eq-detail__meta">
        <div class="eq-detail__row">
          <dt>Наименование</dt>
          <dd>{{ item.name }}</dd>
        </div>
        <div class="eq-detail__row">
          <dt>Категория</dt>
          <dd>{{ categoryLabel }}</dd>
        </div>
        <div class="eq-detail__row">
          <dt>{{ identityColumnTitle(item.category) }}</dt>
          <dd class="mono">{{ identityLabel(item) }}</dd>
        </div>
        <div v-if="item.category === 'EQUIPMENT'" class="eq-detail__row">
          <dt>Количество</dt>
          <dd>{{ item.quantity }}</dd>
        </div>
        <div v-if="item.category !== 'CARD'" class="eq-detail__row">
          <dt>Состояние</dt>
          <dd>{{ CONDITION_LABEL[item.condition] || item.condition }}</dd>
        </div>
        <div class="eq-detail__row">
          <dt>Владелец</dt>
          <dd>{{ ownerLabel(item) }}</dd>
        </div>
        <div v-if="item.conditionNote" class="eq-detail__row">
          <dt>Пояснение</dt>
          <dd>{{ item.conditionNote }}</dd>
        </div>
      </dl>

      <section v-if="supportsDocs" class="eq-detail__docs">
        <h3 class="eq-detail__docs-title">Документы</h3>
        <p v-if="loading" class="muted">Загрузка списка…</p>
        <ul v-else-if="docs.length" class="eq-detail__files">
          <li v-for="doc in docs" :key="doc.id">
            <a
              class="eq-detail__file"
              href="#"
              :title="`${doc.originalName} — ${formatSize(doc.sizeBytes)}`"
              @click.prevent="onDownload(doc)"
            >
              {{ doc.originalName }}
            </a>
            <button
              v-if="canUpload"
              type="button"
              class="icon-btn icon-btn--danger eq-detail__file-remove"
              :disabled="busy"
              aria-label="Удалить файл"
              title="Удалить файл"
              @click="onDelete(doc)"
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
        <p v-else class="muted">Файлов пока нет</p>

        <DocumentDropzone
          v-if="canUpload"
          v-model:files="pendingFiles"
          :disabled="busy"
          title="Новые документы"
        />
        <button
          v-if="canUpload && pendingFiles.length"
          type="button"
          class="btn btn--accent"
          :disabled="busy"
          @click="uploadPending"
        >
          {{ busy ? 'Загрузка…' : `Загрузить (${pendingFiles.length})` }}
        </button>
        <UploadProgress v-if="upload" :state="upload" />
      </section>

      <p v-if="success" class="alert alert--ok">{{ success }}</p>
      <p v-if="error" class="alert">{{ error }}</p>
      <div class="modal__actions">
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="busy"
          @click="$emit('close')"
        >
          Закрыть
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="btn btn--accent"
          :disabled="busy"
          @click="$emit('edit', item)"
        >
          Изменить
        </button>
      </div>
    </div>
  </AppModal>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import AppModal from '../ui/AppModal.vue';
import DocumentDropzone from './DocumentDropzone.vue';
import UploadProgress from './UploadProgress.vue';
import './styles/EquipmentDetailModal.scss';
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocument,
} from '../../api/equipment';
import { useAuthStore } from '../../stores/auth';
import {
  CONDITION_LABEL,
  formatSize,
  identityColumnTitle,
  identityLabel,
  ownerLabel,
} from '../../utils/format';
import { canEditDocumentsItem, canEditItemCard } from '../../utils/access';

const props = defineProps({
  item: { type: Object, required: true },
});
const emit = defineEmits(['close', 'edit', 'updated']);

const auth = useAuthStore();
const docs = ref([]);
const pendingFiles = ref([]);
const loading = ref(false);
const busy = ref(false);
const upload = ref(null);
const error = ref('');
const success = ref('');

const supportsDocs = computed(
  () => props.item.category === 'EQUIPMENT' || props.item.category === 'VEHICLE',
);
const canUpload = computed(
  () => supportsDocs.value && canEditDocumentsItem(auth, props.item),
);
const canEdit = computed(() => canEditItemCard(auth, props.item));
const categoryLabel = computed(() => {
  if (props.item.category === 'VEHICLE') return 'Транспорт';
  if (props.item.category === 'CARD') return 'Карта';
  return 'Оборудование';
});

function clearFeedback() {
  error.value = '';
  success.value = '';
}

async function loadDocs({ quiet = false } = {}) {
  if (!supportsDocs.value) return;
  loading.value = true;
  if (!quiet) clearFeedback();
  try {
    docs.value = await listDocuments(props.item.id);
    // Бэкенд сверяет папку в Битриксе — флаг в списке может устареть.
    if (docs.value.length > 0 !== Boolean(props.item.hasDocuments)) {
      emit('updated');
    }
  } catch (e) {
    error.value = e.message;
    success.value = '';
  } finally {
    loading.value = false;
  }
}

async function onDownload(doc) {
  clearFeedback();
  try {
    const blob = await downloadDocument(doc.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalName || 'document';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.value = e.message;
  }
}

async function onDelete(doc) {
  if (!window.confirm(`Удалить «${doc.originalName}» из Битрикс?`)) return;
  busy.value = true;
  clearFeedback();
  try {
    await deleteDocument(doc.id);
    await loadDocs({ quiet: true });
    success.value = `Файл «${doc.originalName}» удалён`;
    emit('updated');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function uploadPending() {
  if (!pendingFiles.value.length) return;
  busy.value = true;
  clearFeedback();
  const queue = [...pendingFiles.value];
  let uploaded = 0;
  try {
    for (const [index, file] of queue.entries()) {
      upload.value = {
        name: file.name,
        index: index + 1,
        total: queue.length,
        ratio: 0,
      };
      await uploadDocument(props.item.id, file, (ratio) => {
        if (upload.value) upload.value.ratio = ratio;
      });
      pendingFiles.value = pendingFiles.value.filter((item) => item !== file);
      uploaded += 1;
    }
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки файла';
  } finally {
    upload.value = null;
    busy.value = false;
  }

  if (error.value) {
    if (uploaded > 0) {
      error.value = `Загружено ${uploaded} из ${queue.length}. ${error.value}`;
      await loadDocs({ quiet: true });
      emit('updated');
    }
    return;
  }

  await loadDocs({ quiet: true });
  emit('updated');
  if (uploaded > 0 && !docs.value.length) {
    error.value =
      'Файлы отправлены, но в списке не появились. Обновите карточку или обратитесь к администратору.';
  } else if (uploaded > 0) {
    success.value =
      uploaded === 1
        ? 'Документ успешно загружен'
        : `Успешно загружено файлов: ${uploaded}`;
  }
}

onMounted(loadDocs);
</script>
