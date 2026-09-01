<template>
  <section>
    <PageHeader title="Производственные базы" subtitle="Остатки и ответственные">
      <template #actions>
        <button v-if="auth.can('manage_warehouses')" class="btn btn--accent" @click="openForm()">
          Новая база
        </button>
      </template>
    </PageHeader>
    <p v-if="error" class="alert">{{ error }}</p>
    <div class="card table-wrap stack-on-mobile">
      <table v-if="warehouses.length">
        <thead>
          <tr>
            <th>Название</th>
            <th>Адрес</th>
            <th>Кладовщики</th>
            <th>Единиц</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in warehouses" :key="w.id">
            <td data-label="Название">
              <router-link :to="`/warehouses/${w.id}`">{{ w.name }}</router-link>
            </td>
            <td data-label="Адрес">{{ w.address || '—' }}</td>
            <td data-label="Кладовщики">{{ (w.keepers || []).map((k) => k.user?.fullName).join(', ') || '—' }}</td>
            <td data-label="Единиц">{{ w._count?.equipment ?? 0 }}</td>
            <td data-label="">
              <div class="toolbar">
                <button
                  v-if="auth.can('manage_warehouses')"
                  class="btn btn--small btn--ghost"
                  @click="openForm(w)"
                >
                  Изменить
                </button>
                <button
                  v-if="auth.can('manage_warehouses') && !w.isSystem"
                  class="btn btn--small btn--danger"
                  @click="removeWarehouse(w)"
                >
                  Удалить
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Производственных баз пока нет.</div>
    </div>

    <AppModal
      v-if="showForm"
      :title="form.id ? 'Производственная база' : 'Новая производственная база'"
      @close="showForm = false"
    >
      <form class="form-grid" @submit.prevent="save">
        <label>Название <input v-model="form.name" required :disabled="form.isSystem" /></label>
        <label>Адрес <input v-model="form.address" /></label>
        <div class="check-list">
          <span class="check-list__title">Кладовщики</span>
          <p class="muted">
            Можно назначить любого сотрудника, в том числе мастера. Тогда он сможет выдавать оборудование с этой базы.
          </p>
          <label v-for="u in users" :key="u.id" class="check-field">
            <input v-model="form.keeperIds" class="checkbox" type="checkbox" :value="u.id" />
            <span>
              {{ u.fullName }}
              <span class="muted">{{ u.role?.name || '' }}</span>
            </span>
          </label>
        </div>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" @click="showForm = false">Отмена</button>
          <button class="btn btn--accent">Сохранить</button>
        </div>
      </form>
    </AppModal>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import { fetchUsers, fetchWarehouses } from '../api/catalog';
import { useAuthStore } from '../stores/auth';
import PageHeader from '../components/ui/PageHeader.vue';
import AppModal from '../components/ui/AppModal.vue';

const auth = useAuthStore();
const warehouses = ref([]);
const users = ref([]);
const error = ref('');
const showForm = ref(false);
const form = reactive({ id: '', name: '', address: '', keeperIds: [], isSystem: false });

async function load() {
  warehouses.value = await fetchWarehouses();
  users.value = await fetchUsers();
}

function openForm(w) {
  form.id = w?.id || '';
  form.name = w?.name || '';
  form.address = w?.address || '';
  form.keeperIds = (w?.keepers || []).map((k) => k.userId);
  form.isSystem = Boolean(w?.isSystem);
  showForm.value = true;
}

async function removeWarehouse(w) {
  if (!confirm(`Удалить производственную базу «${w.name}»?`)) return;
  try {
    await api(`/warehouses/${w.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function save() {
  const payload = {
    name: form.name,
    address: form.address,
    keeperIds: form.keeperIds,
  };
  if (form.id) {
    await api(`/warehouses/${form.id}`, { method: 'PATCH', body: payload });
  } else {
    await api('/warehouses', { method: 'POST', body: payload });
  }
  showForm.value = false;
  await load();
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
