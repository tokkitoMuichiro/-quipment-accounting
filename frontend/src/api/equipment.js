import { api, apiUpload } from './client';

export const DOC_MAX_BYTES = 50 * 1024 * 1024;
export const DOC_MAX_LABEL = '50 МБ';

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

export function listDocuments(equipmentId) {
  return api(`/equipment/${equipmentId}/documents`);
}

export function uploadDocument(equipmentId, file, onProgress) {
  const body = new FormData();
  body.append('file', file);
  return apiUpload(`/equipment/${equipmentId}/documents`, { body, onProgress });
}

export function downloadDocument(documentId) {
  return api(`/documents/${documentId}/download`);
}

export function deleteDocument(documentId) {
  return api(`/documents/${documentId}`, { method: 'DELETE' });
}

export function syncDocuments() {
  return api('/documents/sync', { method: 'POST' });
}
