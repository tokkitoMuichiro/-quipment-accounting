import { api } from './client';

export function fetchUsers() {
  return api('/users');
}

export function fetchEmployees() {
  return api('/bitrix/employees');
}

export function fetchWarehouses() {
  return api('/warehouses');
}

export function fetchWarehouse(id) {
  return api(`/warehouses/${id}`);
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
