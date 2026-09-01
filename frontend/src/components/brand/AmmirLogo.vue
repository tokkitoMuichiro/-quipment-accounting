<template>
  <img
    :src="src"
    :alt="alt"
    :class="['brand-logo', compact ? 'brand-logo--mark' : 'brand-logo--full']"
  />
</template>

<script setup>
import mark from '../../assets/ammir-logo.svg';
import full from '../../assets/ammir-logo-white.svg';
import './styles/AmmirLogo.scss';

const props = defineProps({
  compact: { type: Boolean, default: false },
  alt: { type: String, default: 'АММИР' },
});

const src = props.compact ? mark : full;
</script>
