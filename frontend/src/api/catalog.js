import { api } from './client';

export function fetchUsers(category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return api(`/users${qs}`);
}

export function fetchEmployees() {
  return api('/bitrix/employees');
}

export function fetchWarehouses() {
  return api('/warehouses');
}

export function fetchWarehouse(id, category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return api(`/warehouses/${id}${qs}`);
}

export function fetchTransfers() {
  return api('/transfers');
}

export function fetchRoles() {
  return api('/roles');
}

export function fetchRoleCatalog() {
  return api('/roles/catalog');
}
