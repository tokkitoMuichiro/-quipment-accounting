<template>
  <div class="layout">
    <AppTopbar @toggle-menu="menuOpen = !menuOpen" />
    <div v-if="menuOpen" class="sidebar__overlay" @click="menuOpen = false" />
    <AppSidebar
      :open="menuOpen"
      :downloading="downloading"
      :sync-msg="syncMsg"
      @navigate="menuOpen = false"
      @download-excel="downloadLocal"
      @logout="logout"
    />
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import './styles/AppLayout.scss';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
import AppTopbar from '../components/layout/AppTopbar.vue';
import AppSidebar from '../components/layout/AppSidebar.vue';

const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);
const downloading = ref(false);
const syncMsg = ref('');

function logout() {
  auth.logout().then(() => router.push('/login'));
}

async function downloadLocal() {
  downloading.value = true;
  syncMsg.value = '';
  try {
    const blob = await api('/excel/download');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Учёт оборудования.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    syncMsg.value = e.message;
  } finally {
    downloading.value = false;
  }
}
</script>
