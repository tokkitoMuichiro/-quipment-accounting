<template>
  <AppModal title="Что добавить?" @close="$emit('close')">
    <div class="asset-pick">
      <button type="button" class="btn btn--accent asset-pick__btn" @click="$emit('pick', 'EQUIPMENT')">
        Оборудование
      </button>
      <button type="button" class="btn btn--accent asset-pick__btn" @click="$emit('pick', 'VEHICLE')">
        Транспорт
      </button>
      <button type="button" class="btn btn--accent asset-pick__btn" @click="$emit('pick', 'CARD')">
        Карта
      </button>
    </div>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" @click="$emit('close')">Отмена</button>
    </div>
  </AppModal>
</template>

<script setup>
import AppModal from '../ui/AppModal.vue';

defineEmits(['close', 'pick']);
</script>

<style scoped>
.asset-pick {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.asset-pick__btn {
  width: 100%;
}
</style>
