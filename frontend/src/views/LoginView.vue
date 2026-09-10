<template>
  <div class="login">
    <div class="card login__card">
      <div class="login__brand">
        <AmmirLogo />
      </div>
      <h1>Учёт оборудования</h1>
      <p>
        В рабочем режиме приложение открывается из вкладки Битрикс24 и подставляет ФИО сотрудника
        автоматически.
      </p>

      <template v-if="devEnabled">
        <div class="login__presets">
          <p class="login__presets-title">Тестовый вход (только локально)</p>
          <div class="login__presets-grid">
            <button
              v-for="p in presets"
              :key="p.bitrixUserId"
              type="button"
              class="btn btn--ghost login__preset"
              :disabled="loading"
              @click="loginAs(p)"
            >
              <span class="login__preset-name">{{ p.fullName }}</span>
              <span class="login__preset-role">{{ p.roleLabel }}</span>
            </button>
          </div>
        </div>

        <form class="form-grid" @submit.prevent="submit">
          <label>
            Или введите ФИО вручную
            <input v-model="fullName" placeholder="Иван Петров" minlength="2" />
          </label>
          <p v-if="error" class="alert">{{ error }}</p>
          <button class="btn btn--accent" :disabled="loading || fullName.trim().length < 2">
            Войти
          </button>
        </form>
      </template>
      <p v-else-if="statusLoaded" class="login__prod-hint">
        Откройте приложение из меню Битрикс24.
      </p>
      <p v-if="authError" class="alert">{{ authError }}</p>
      <p v-if="error && !devEnabled" class="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import './styles/LoginView.scss';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import AmmirLogo from '../components/brand/AmmirLogo.vue';

const presets = [
  {
    fullName: 'Админ Тестов',
    roleSlug: 'admin',
    bitrixUserId: 'dev:admin-testov',
    roleLabel: 'админ — роли, замечания, всё',
  },
  {
    fullName: 'Мастер Иванов',
    roleSlug: 'master',
    bitrixUserId: 'dev:master-ivanov',
    roleLabel: 'мастер — своё оборудование',
  },
  {
    fullName: 'Мастер Сидоров',
    roleSlug: 'master',
    bitrixUserId: 'dev:master-sidorov',
    roleLabel: 'второй мастер — передачи между людьми',
  },
  {
    fullName: 'Кладовщик Складской',
    roleSlug: 'keeper',
    bitrixUserId: 'dev:keeper-sklad',
    roleLabel: 'кладовщик — База Север и Ремонт',
  },
];

const auth = useAuthStore();
const router = useRouter();
const fullName = ref('');
const error = ref('');
const loading = ref(false);
const devEnabled = ref(false);
const statusLoaded = ref(false);
const authError = computed(() => auth.error || '');

onMounted(async () => {
  try {
    const status = await api('/auth/dev-status');
    devEnabled.value = Boolean(status?.enabled);
  } catch {
    devEnabled.value = false;
  } finally {
    statusLoaded.value = true;
  }
});

async function enter(payload) {
  loading.value = true;
  error.value = '';
  try {
    await auth.devLogin(payload);
    router.push('/mine');
  } catch (e) {
    error.value =
      e.message === 'Локальный вход выключен'
        ? 'Откройте приложение из Битрикс24. Локальный вход на сервере выключен.'
        : e.message;
  } finally {
    loading.value = false;
  }
}

function loginAs(preset) {
  return enter({
    fullName: preset.fullName,
    roleSlug: preset.roleSlug,
    bitrixUserId: preset.bitrixUserId,
  });
}

function submit() {
  return enter({ fullName: fullName.value.trim() });
}
</script>
