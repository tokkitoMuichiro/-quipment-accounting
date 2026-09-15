import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const assetList = () => import('../views/EquipmentListView.vue');
const peopleList = () => import('../views/PeopleEquipmentView.vue');

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
        component: assetList,
        meta: { scope: 'mine', category: 'equipment', title: 'Моё оборудование' },
      },
      {
        path: 'mine/vehicles',
        name: 'mine-vehicles',
        component: assetList,
        meta: { scope: 'mine', category: 'vehicles', title: 'Мой транспорт' },
      },
      {
        path: 'mine/cards',
        name: 'mine-cards',
        component: assetList,
        meta: { scope: 'mine', category: 'cards', title: 'Мои карты' },
      },
      {
        path: 'people',
        name: 'people',
        component: peopleList,
        meta: { category: 'equipment', title: 'Оборудование у сотрудников' },
      },
      {
        path: 'people/vehicles',
        name: 'people-vehicles',
        component: peopleList,
        meta: { category: 'vehicles', title: 'Транспорт у сотрудников' },
      },
      {
        path: 'people/cards',
        name: 'people-cards',
        component: peopleList,
        meta: { category: 'cards', title: 'Карты у сотрудников' },
      },
      {
        path: 'fleet',
        name: 'fleet',
        component: assetList,
        meta: {
          scope: 'all',
          category: 'equipment',
          title: 'Всё оборудование',
          perm: 'view_all',
        },
      },
      {
        path: 'fleet/vehicles',
        name: 'fleet-vehicles',
        component: assetList,
        meta: {
          scope: 'all',
          category: 'vehicles',
          title: 'Весь транспорт',
          perm: 'view_all',
        },
      },
      {
        path: 'fleet/cards',
        name: 'fleet-cards',
        component: assetList,
        meta: {
          scope: 'all',
          category: 'cards',
          title: 'Все карты',
          perm: 'view_all',
        },
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
