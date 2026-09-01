import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../views/AppLayout.vue'),
    children: [
      { path: '', redirect: '/mine' },
      {
        path: 'mine',
        name: 'mine',
        component: () => import('../views/EquipmentListView.vue'),
        meta: { scope: 'mine', title: 'Моё оборудование' },
      },
      {
        path: 'people',
        name: 'people',
        component: () => import('../views/PeopleEquipmentView.vue'),
      },
      {
        path: 'fleet',
        name: 'fleet',
        component: () => import('../views/EquipmentListView.vue'),
        meta: { scope: 'all', title: 'Всё оборудование', perm: 'view_all' },
      },
      {
        path: 'warehouses',
        name: 'warehouses',
        component: () => import('../views/WarehousesView.vue'),
      },
      {
        path: 'warehouses/:id',
        name: 'warehouse',
        component: () => import('../views/WarehouseDetailView.vue'),
      },
      {
        path: 'history',
        name: 'history',
        component: () => import('../views/HistoryView.vue'),
      },
      {
        path: 'admin/roles',
        name: 'roles',
        component: () => import('../views/AdminRolesView.vue'),
        meta: { perm: 'manage_roles' },
      },
      {
        path: 'admin/users',
        name: 'users',
        component: () => import('../views/AdminUsersView.vue'),
        meta: { perm: 'manage_roles' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.meta.public) {
    return true;
  }
  const auth = useAuthStore();
  if (!auth.user) {
    await auth.fetchMe();
  }
  if (!auth.user) {
    return { name: 'login' };
  }
  if (to.meta.perm && !auth.can(to.meta.perm)) {
    return { name: 'mine' };
  }
  return true;
});

export default router;
