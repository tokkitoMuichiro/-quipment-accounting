<template>
  <AppModal :title="item?.name || 'Позиция'" hint="Документы хранятся в Битрикс" @close="$emit('close')">
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
            <button type="button" class="eq-detail__file" @click="onDownload(doc)">
              {{ doc.originalName }}
              <span class="muted">{{ formatSize(doc.sizeBytes) }}</span>
            </button>
            <button
              v-if="canUpload"
              type="button"
              class="btn btn--ghost btn--small"
              :disabled="busy"
              @click="onDelete(doc)"
            >
              Удалить
            </button>
          </li>
        </ul>
        <p v-else class="muted">Файлов пока нет</p>

        <DocumentDropzone
          v-if="canUpload"
          v-model:files="pendingFiles"
          :disabled="busy"
          title="Добавить документы"
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
      </section>

      <p v-if="error" class="alert">{{ error }}</p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="$emit('close')">Закрыть</button>
        <button
          v-if="canEdit"
          type="button"
          class="btn btn--accent"
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
const error = ref('');

const supportsDocs = computed(
  () => props.item.category === 'EQUIPMENT' || props.item.category === 'VEHICLE',
);
const canUpload = computed(
  () =>
    supportsDocs.value &&
    (canEditDocumentsItem(auth, props.item) || canEditItemCard(auth, props.item)),
);
const canEdit = computed(() => canEditItemCard(auth, props.item));
const categoryLabel = computed(() => {
  if (props.item.category === 'VEHICLE') return 'Транспорт';
  if (props.item.category === 'CARD') return 'Карта';
  return 'Оборудование';
});

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

async function loadDocs() {
  if (!supportsDocs.value) return;
  loading.value = true;
  error.value = '';
  try {
    docs.value = await listDocuments(props.item.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function onDownload(doc) {
  error.value = '';
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
  error.value = '';
  try {
    await deleteDocument(doc.id);
    await loadDocs();
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
  error.value = '';
  try {
    for (const file of pendingFiles.value) {
      await uploadDocument(props.item.id, file);
    }
    pendingFiles.value = [];
    await loadDocs();
    emit('updated');
  } catch (e) {
    error.value = e.message;
    await loadDocs();
    emit('updated');
  } finally {
    busy.value = false;
  }
}

onMounted(loadDocs);
</script>
