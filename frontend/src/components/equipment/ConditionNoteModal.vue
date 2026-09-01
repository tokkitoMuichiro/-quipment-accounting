<template>
  <AppModal :title="title" :hint="hint" @close="$emit('close')">
    <form class="form-grid" @submit.prevent="submit">
      <label>
        Пояснение
        <textarea
          v-model="note"
          rows="4"
          :required="noteRequired"
          :minlength="noteRequired ? 3 : undefined"
          placeholder="Что случилось, что сломалось, причина"
        />
      </label>
      <p v-if="error" class="alert">{{ error }}</p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn--accent" :disabled="saving">Сохранить</button>
      </div>
    </form>
  </AppModal>
</template>

<script setup>
import { computed, ref } from 'vue';
import AppModal from '../ui/AppModal.vue';
import { updateEquipment } from '../../api/equipment';
import { CONDITION_LABEL, conditionNeedsNote } from '../../utils/format';

const props = defineProps({
  item: { type: Object, required: true },
  condition: { type: String, required: true },
});
const emit = defineEmits(['close', 'saved']);

const note = ref(props.item.conditionNote || '');
const saving = ref(false);
const error = ref('');
const noteRequired = computed(() => conditionNeedsNote(props.condition));
const title = computed(() => CONDITION_LABEL[props.condition] || 'Состояние');
const hint = computed(() => {
  if (props.condition === 'IN_REPAIR') {
    return 'Оборудование будет передано на базу «Ремонт». Укажите причину.';
  }
  if (props.item.condition === 'IN_REPAIR' && props.condition === 'OK') {
    return 'Оборудование останется на базе «Ремонт», пока назначенный кладовщик или администратор не передаст его дальше.';
  }
  if (noteRequired.value) {
    return 'Укажите причину изменения состояния.';
  }
  return 'Пояснение не обязательно для исправного состояния.';
});

async function submit() {
  const trimmed = note.value.trim();
  if (noteRequired.value && trimmed.length < 3) {
    error.value = 'Укажите пояснение: что случилось с оборудованием';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await updateEquipment(props.item.id, {
      condition: props.condition,
      conditionNote: noteRequired.value ? trimmed : trimmed || null,
    });
    emit('saved');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
