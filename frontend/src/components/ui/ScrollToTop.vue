<template>
  <button
    v-show="visible"
    type="button"
    class="scroll-top"
    aria-label="Наверх"
    title="Наверх"
    @click="scrollUp"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 14.5 12 8.5l6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import './styles/ScrollToTop.scss';

const visible = ref(false);
const THRESHOLD = 360;

function onScroll() {
  visible.value = window.scrollY > THRESHOLD;
}

function scrollUp() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>
