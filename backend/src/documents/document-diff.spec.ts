import { diffDocuments, diffIsEmpty } from './document-diff';

const remoteFile = (id: string, name = `${id}.pdf`, sizeBytes = 100) => ({
  id,
  name,
  sizeBytes,
  mimeType: 'application/pdf',
});

const localDoc = (
  id: string,
  bitrixFileId: string,
  originalName = `${bitrixFileId}.pdf`,
  sizeBytes = 100,
) => ({ id, bitrixFileId, originalName, sizeBytes });

describe('diffDocuments', () => {
  it('reports nothing to do when both sides match', () => {
    const diff = diffDocuments([remoteFile('1')], [localDoc('doc-1', '1')]);
    expect(diffIsEmpty(diff)).toBe(true);
    expect(diff.hasDocuments).toBe(true);
  });

  it('adds files uploaded straight into Bitrix', () => {
    const diff = diffDocuments(
      [remoteFile('1'), remoteFile('2', 'стс.pdf', 2048)],
      [localDoc('doc-1', '1')],
    );
    expect(diff.toAdd.map((f) => f.id)).toEqual(['2']);
    expect(diff.toDeleteIds).toEqual([]);
  });

  it('drops rows whose file was deleted in Bitrix', () => {
    const diff = diffDocuments([], [localDoc('doc-1', '1')]);
    expect(diff.toDeleteIds).toEqual(['doc-1']);
    expect(diff.hasDocuments).toBe(false);
  });

  it('refreshes renamed or resized files', () => {
    const diff = diffDocuments(
      [remoteFile('1', 'паспорт.pdf', 4096)],
      [localDoc('doc-1', '1', 'стс.pdf', 100)],
    );
    expect(diff.toUpdate).toEqual([
      { id: 'doc-1', originalName: 'паспорт.pdf', sizeBytes: 4096 },
    ]);
  });
});
