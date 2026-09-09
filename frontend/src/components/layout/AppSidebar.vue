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
      <label class="sidebar__notify">
        <input
          class="checkbox"
          type="checkbox"
          :checked="auth.user?.notifyBitrix !== false"
          :disabled="notifySaving"
          @change="onNotifyToggle($event.target.checked)"
        />
        Уведомления в Битрикс
      </label>
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
      <p v-if="notifyMsg" class="sidebar__hint">{{ notifyMsg }}</p>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';
import AmmirLogo from '../brand/AmmirLogo.vue';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';
import './styles/AppSidebar.scss';

defineProps({
  open: { type: Boolean, default: false },
  downloading: { type: Boolean, default: false },
  syncMsg: { type: String, default: '' },
});
defineEmits(['navigate', 'download-excel', 'logout']);

const auth = useAuthStore();
const notifySaving = ref(false);
const notifyMsg = ref('');

async function onNotifyToggle(enabled) {
  notifySaving.value = true;
  notifyMsg.value = '';
  try {
    const user = await api('/auth/me/settings', {
      method: 'PATCH',
      body: { notifyBitrix: enabled },
    });
    auth.user = user;
    notifyMsg.value = enabled
      ? 'Уведомления включены'
      : 'Уведомления выключены';
  } catch (e) {
    notifyMsg.value = e.message;
  } finally {
    notifySaving.value = false;
  }
}
</script>
