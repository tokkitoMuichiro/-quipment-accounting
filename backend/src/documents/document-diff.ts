export interface RemoteFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

export interface LocalDocument {
  id: string;
  bitrixFileId: string;
  originalName: string;
  sizeBytes: number;
}

export interface DocumentDiff {
  /** Files present in Bitrix but missing in the app. */
  toAdd: RemoteFile[];
  /** Rows whose Bitrix file is gone. */
  toDeleteIds: string[];
  /** Rows whose name or size drifted from Bitrix. */
  toUpdate: { id: string; originalName: string; sizeBytes: number }[];
  hasDocuments: boolean;
}

export function diffDocuments(
  remote: RemoteFile[],
  local: LocalDocument[],
): DocumentDiff {
  const remoteById = new Map(remote.map((file) => [file.id, file]));
  const localByFileId = new Map(local.map((doc) => [doc.bitrixFileId, doc]));

  const toAdd = remote.filter((file) => !localByFileId.has(file.id));
  const toDeleteIds = local
    .filter((doc) => !remoteById.has(doc.bitrixFileId))
    .map((doc) => doc.id);
  const toUpdate = local
    .filter((doc) => {
      const file = remoteById.get(doc.bitrixFileId);
      if (!file) return false;
      return file.name !== doc.originalName || file.sizeBytes !== doc.sizeBytes;
    })
    .map((doc) => {
      const file = remoteById.get(doc.bitrixFileId)!;
      return {
        id: doc.id,
        originalName: file.name,
        sizeBytes: file.sizeBytes,
      };
    });

  return {
    toAdd,
    toDeleteIds,
    toUpdate,
    hasDocuments: remote.length > 0,
  };
}

export function diffIsEmpty(diff: DocumentDiff): boolean {
  return (
    diff.toAdd.length === 0 &&
    diff.toDeleteIds.length === 0 &&
    diff.toUpdate.length === 0
  );
}
