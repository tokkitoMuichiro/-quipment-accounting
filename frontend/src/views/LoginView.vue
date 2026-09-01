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
      <form class="form-grid" @submit.prevent="submit">
        <label>
          Вход для локальной разработки
          <input v-model="fullName" placeholder="Иван Петров" required minlength="2" />
        </label>
        <p v-if="error" class="alert">{{ error }}</p>
        <button class="btn btn--accent" :disabled="loading">Войти</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import './styles/LoginView.scss';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AmmirLogo from '../components/brand/AmmirLogo.vue';

const auth = useAuthStore();
const router = useRouter();
const fullName = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.devLogin(fullName.value);
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
</script>
