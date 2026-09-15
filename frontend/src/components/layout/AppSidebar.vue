<template>
  <aside class="sidebar" :class="{ 'is-open': open }">
    <div class="brand">
      <AmmirLogo />
      <p>Учёт оборудования</p>
    </div>
    <nav class="nav" @click="onNavClick">
      <div class="nav__block">
        <button type="button" class="nav__parent" @click.stop="toggle('mine')">
          Мое оборудование
          <span class="nav__chevron" :class="{ 'is-open': openGroups.mine }">▾</span>
        </button>
        <div v-show="openGroups.mine" class="nav__sub">
          <router-link to="/mine">Оборудование</router-link>
          <router-link to="/mine/vehicles">Транспорт</router-link>
          <router-link to="/mine/cards">Карты</router-link>
        </div>
      </div>
      <div class="nav__block">
        <button type="button" class="nav__parent" @click.stop="toggle('people')">
          Оборудование у сотрудников
          <span class="nav__chevron" :class="{ 'is-open': openGroups.people }">▾</span>
        </button>
        <div v-show="openGroups.people" class="nav__sub">
          <router-link to="/people">Оборудование</router-link>
          <router-link to="/people/vehicles">Транспорт</router-link>
          <router-link to="/people/cards">Карты</router-link>
        </div>
      </div>
      <div v-if="auth.can('view_all')" class="nav__block">
        <button type="button" class="nav__parent" @click.stop="toggle('fleet')">
          Все оборудование
          <span class="nav__chevron" :class="{ 'is-open': openGroups.fleet }">▾</span>
        </button>
        <div v-show="openGroups.fleet" class="nav__sub">
          <router-link to="/fleet">Оборудование</router-link>
          <router-link to="/fleet/vehicles">Транспорт</router-link>
          <router-link to="/fleet/cards">Карты</router-link>
        </div>
      </div>
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
import { reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AmmirLogo from '../brand/AmmirLogo.vue';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';
import './styles/AppSidebar.scss';

defineProps({
  open: { type: Boolean, default: false },
  downloading: { type: Boolean, default: false },
  syncMsg: { type: String, default: '' },
});
const emit = defineEmits(['navigate', 'download-excel', 'logout']);

const auth = useAuthStore();
const route = useRoute();
const notifySaving = ref(false);
const notifyMsg = ref('');
const openGroups = reactive({
  mine: false,
  people: false,
  fleet: false,
});

function collapseAll() {
  openGroups.mine = false;
  openGroups.people = false;
  openGroups.fleet = false;
}

function toggle(key) {
  const willOpen = !openGroups[key];
  collapseAll();
  if (willOpen) {
    openGroups[key] = true;
  }
}

function onNavClick(e) {
  if (e.target.closest('a')) {
    emit('navigate');
  }
}

function groupFromPath(path) {
  if (path.startsWith('/mine')) return 'mine';
  if (path.startsWith('/people')) return 'people';
  if (path.startsWith('/fleet')) return 'fleet';
  return null;
}

watch(
  () => route.path,
  (path) => {
    const group = groupFromPath(path);
    collapseAll();
    if (group) {
      openGroups[group] = true;
    }
  },
);

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
