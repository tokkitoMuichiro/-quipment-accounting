<template>
  <div class="eq-condition" :class="toneClass">
    <button
      ref="btnRef"
      type="button"
      class="eq-condition__btn"
      :title="note || undefined"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      {{ currentLabel }}
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        class="eq-condition__menu"
        :style="menuStyle"
        role="listbox"
        @click.stop
      >
        <li
          v-for="opt in CONDITION_OPTIONS"
          :key="opt.value"
          class="eq-condition__opt"
          :class="[
            `eq-condition--${CONDITION_TONE[opt.value]}`,
            { 'is-active': opt.value === modelValue },
          ]"
          role="option"
          :aria-selected="opt.value === modelValue"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { CONDITION_OPTIONS, CONDITION_TONE, CONDITION_LABEL } from '../../utils/format';
import './styles/ConditionSelect.scss';

const props = defineProps({
  modelValue: { type: String, required: true },
  note: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: 'Состояние' },
});
const emit = defineEmits(['change']);

const open = ref(false);
const btnRef = ref(null);
const menuStyle = ref({});
const currentLabel = computed(() => CONDITION_LABEL[props.modelValue] || props.modelValue);
const toneClass = computed(() => `eq-condition--${CONDITION_TONE[props.modelValue] || 'ok'}`);

function close() {
  open.value = false;
}

function placeMenu() {
  const el = btnRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const width = Math.max(r.width, 168);
  const left = Math.min(r.left, window.innerWidth - width - 8);
  const below = r.bottom + 4;
  const estimated = 168;
  const top = below + estimated > window.innerHeight ? r.top - estimated - 4 : below;
  menuStyle.value = {
    position: 'fixed',
    top: `${Math.max(8, top)}px`,
    left: `${Math.max(8, left)}px`,
    width: `${width}px`,
  };
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) placeMenu();
}

function pick(value) {
  close();
  if (value !== props.modelValue) emit('change', value);
}

function onDocPointer(e) {
  if (!open.value) return;
  const btn = btnRef.value;
  if (btn && btn.contains(e.target)) return;
  if (e.target.closest?.('.eq-condition__menu')) return;
  close();
}

function onKey(e) {
  if (e.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
  window.addEventListener('keydown', onKey);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
});
</script>
