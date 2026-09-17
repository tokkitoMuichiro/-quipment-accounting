export const ACCOUNTING_FOLDER_NAME = 'Учет оборудования';
export const DOCS_FOLDER_NAME = 'Документы';

export function equipmentFolderName(input: {
  id: string;
  name: string;
  factoryNumber?: string | null;
  plateNumber?: string | null;
  category?: string | null;
}): string {
  const base =
    input.category === 'VEHICLE'
      ? [input.name, input.plateNumber].filter(Boolean).join(' ')
      : [input.name, input.factoryNumber].filter(Boolean).join(' ');
  const cleaned = base.replace(/\s+/g, ' ').trim();
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 180);
  }
  return `Позиция ${input.id.slice(0, 8)}`;
}

export function decodeUploadFileName(raw: string): string {
  const name = String(raw || '').trim();
  if (!name) return 'document';
  // Multer/busboy часто отдаёт UTF-8 имя как Latin-1 («Ð¡Ð¢Ð¡…»).
  if (/[ÐÑ]/.test(name) || /Ã./.test(name)) {
    try {
      const fixed = Buffer.from(name, 'latin1').toString('utf8');
      if (fixed && !fixed.includes('\uFFFD')) {
        return fixed;
      }
    } catch {
      /* keep original */
    }
  }
  return name;
}

export type UploadedMemoryFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export const DOC_ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const DOC_MAX_BYTES = 50 * 1024 * 1024;

export const DOC_MAX_LABEL = `${Math.round(DOC_MAX_BYTES / (1024 * 1024))} МБ`;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function guessMimeFromName(name: string): string {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}
