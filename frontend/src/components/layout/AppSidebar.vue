<template>
  <aside class="sidebar" :class="{ 'is-open': open }">
    <div class="brand">
      <AmmirLogo />
      <p>Учёт оборудования</p>
    </div>
    <nav class="nav" @click="$emit('navigate')">
      <router-link to="/mine">Моё оборудование</router-link>
      <router-link to="/people">Оборудование у сотрудников</router-link>
      <router-link v-if="auth.can('view_all')" to="/fleet">Всё оборудование</router-link>
      <router-link to="/warehouses">Производственные базы</router-link>
      <router-link to="/history">История</router-link>
      <div v-if="auth.can('manage_roles')" class="nav__group">Настройки</div>
      <router-link v-if="auth.can('manage_roles')" to="/admin/users">Сотрудники</router-link>
      <router-link v-if="auth.can('manage_roles')" to="/admin/roles">Роли и права</router-link>
    </nav>
    <div class="sidebar__user">
      <strong>{{ auth.user?.fullName }}</strong>
      <span>{{ auth.user?.role?.name }}</span>
      <div class="toolbar sidebar__actions">
        <button
          v-if="auth.can('export_excel')"
          class="btn btn--small btn--accent"
          :disabled="downloading"
          @click="$emit('download-excel')"
        >
          {{ downloading ? 'Скачивание…' : 'Скачать' }}
        </button>
        <button class="btn btn--small btn--ghost btn--ghost-on-dark" @click="$emit('logout')">
          Выйти
        </button>
      </div>
      <p v-if="syncMsg" class="sidebar__hint">{{ syncMsg }}</p>
    </div>
  </aside>
</template>

<script setup>
import AmmirLogo from '../brand/AmmirLogo.vue';
import { useAuthStore } from '../../stores/auth';
import './styles/AppSidebar.scss';

defineProps({
  open: { type: Boolean, default: false },
  downloading: { type: Boolean, default: false },
  syncMsg: { type: String, default: '' },
});
defineEmits(['navigate', 'download-excel', 'logout']);

const auth = useAuthStore();
</script>
