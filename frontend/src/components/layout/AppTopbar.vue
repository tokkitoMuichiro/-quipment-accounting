<template>
  <header class="topbar">
    <button class="topbar__menu" type="button" aria-label="Меню" @click="$emit('toggle-menu')">☰</button>
    <AmmirLogo compact />
    <span class="topbar__user">{{ auth.user?.fullName }}</span>
  </header>
</template>

<script setup>
import AmmirLogo from '../brand/AmmirLogo.vue';
import { useAuthStore } from '../../stores/auth';
import './styles/AppTopbar.scss';

defineEmits(['toggle-menu']);
const auth = useAuthStore();
</script>
