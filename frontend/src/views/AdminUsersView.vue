<template>
  <section>
    <PageHeader title="Сотрудники" subtitle="ФИО приходит из Битрикс24. Роль назначает администратор.">
      <template #actions>
        <button class="btn btn--ghost" @click="syncEmployees">Синхронизировать сотрудников</button>
      </template>
    </PageHeader>
    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Загрузка…</p>
    <div class="card table-wrap stack-on-mobile">
      <table>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Роль</th>
            <th>Единиц</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td data-label="ФИО">
              {{ u.fullName }}
              <div class="muted">{{ u.email || u.bitrixUserId }}</div>
            </td>
            <td data-label="Роль">
              <select :value="u.roleId" @change="changeRole(u, $event.target.value)">
                <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </td>
            <td data-label="Единиц">{{ u._count?.equipment ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { fetchEmployees } from '../api/catalog';
import PageHeader from '../components/ui/PageHeader.vue';

const users = ref([]);
const roles = ref([]);
const error = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    roles.value = await api('/roles');
    users.value = await api('/users');
  } finally {
    loading.value = false;
  }
}

async function syncEmployees() {
  error.value = '';
  try {
    await fetchEmployees();
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function changeRole(user, roleId) {
  try {
    await api(`/users/${user.id}/role`, { method: 'PATCH', body: { roleId } });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
