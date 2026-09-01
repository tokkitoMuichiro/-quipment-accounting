<template>
  <section>
    <PageHeader title="Роли и права" subtitle="Администратор задаёт, кто видит оборудование, кто правит и кто может удалять">
      <template #actions>
        <button class="btn btn--accent" @click="openCreate">Новая роль</button>
      </template>
    </PageHeader>
    <p v-if="error" class="alert">{{ error }}</p>
    <div class="card table-wrap stack-on-mobile">
      <table>
        <thead>
          <tr>
            <th>Роль</th>
            <th>Людей</th>
            <th>Права</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in roles" :key="role.id">
            <td data-label="Роль">{{ role.name }}</td>
            <td data-label="Людей">{{ role._count?.users ?? 0 }}</td>
            <td data-label="Права">{{ (role.permissions || []).map(labelOf).join(', ') }}</td>
            <td data-label="">
              <button class="btn btn--small btn--ghost" @click="openEdit(role)">Настроить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal v-if="show" :title="form.id ? form.name : 'Новая роль'" @close="show = false">
      <form class="form-grid" @submit.prevent="save">
        <label>Название <input v-model="form.name" required /></label>
        <div class="role-perms">
          <label v-for="p in catalog" :key="p.key" class="role-perms__item">
            <input class="checkbox" v-model="form.permissions" type="checkbox" :value="p.key" />
            <span>{{ p.label }}</span>
          </label>
        </div>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" @click="show = false">Отмена</button>
          <button class="btn btn--accent">Сохранить</button>
        </div>
      </form>
    </AppModal>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import PageHeader from '../components/ui/PageHeader.vue';
import AppModal from '../components/ui/AppModal.vue';
import './styles/AdminRolesView.scss';

const roles = ref([]);
const catalog = ref([]);
const error = ref('');
const show = ref(false);
const form = reactive({ id: '', name: '', permissions: [] });

function labelOf(key) {
  return catalog.value.find((p) => p.key === key)?.label || key;
}

async function load() {
  catalog.value = await api('/roles/catalog');
  roles.value = await api('/roles');
}

function openCreate() {
  form.id = '';
  form.name = '';
  form.permissions = ['view_own'];
  show.value = true;
}

function openEdit(role) {
  form.id = role.id;
  form.name = role.name;
  form.permissions = [...(role.permissions || [])];
  show.value = true;
}

async function save() {
  if (form.id) {
    await api(`/roles/${form.id}`, {
      method: 'PATCH',
      body: { name: form.name, permissions: form.permissions },
    });
  } else {
    await api('/roles', {
      method: 'POST',
      body: { name: form.name, permissions: form.permissions },
    });
  }
  show.value = false;
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
