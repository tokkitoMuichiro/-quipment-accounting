import { api } from './client';

export function fetchEquipment(query = '') {
  return api(`/equipment${query}`);
}

export function fetchEquipmentAlerts() {
  return api('/equipment/alerts');
}

export function createEquipment(body) {
  return api('/equipment', { method: 'POST', body });
}

export function updateEquipment(id, body) {
  return api(`/equipment/${id}`, { method: 'PATCH', body });
}

export function removeEquipment(id) {
  return api(`/equipment/${id}`, { method: 'DELETE' });
}

export function transferEquipment(id, body) {
  return api(`/equipment/${id}/transfer`, { method: 'POST', body });
}

export function bulkTransferEquipment(body) {
  return api('/equipment/bulk-transfer', { method: 'POST', body });
}

export function acceptTransfer(id) {
  return api(`/equipment/${id}/accept`, { method: 'POST' });
}

export function cancelPendingTransfer(id) {
  return api(`/equipment/${id}/cancel-pending`, { method: 'POST' });
}

export function flagFill(id, comment) {
  return api(`/equipment/${id}/flag-fill`, { method: 'POST', body: { comment } });
}

export function confirmFill(id) {
  return api(`/equipment/${id}/confirm-fill`, { method: 'POST' });
}
