import { useCallback } from "react";

const DB_NAME = "renisual-photos";
const PHOTOS_STORE = "photos";
const RENDERS_STORE = "renders";
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) db.createObjectStore(PHOTOS_STORE);
      if (!db.objectStoreNames.contains(RENDERS_STORE)) db.createObjectStore(RENDERS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getValue<T>(store: string, key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const req = db.transaction(store, "readonly").objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function putValue(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function deleteKey(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function clearStore(store: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function usePhotoStore() {
  const savePhoto = useCallback(
    (sideId: string, dataUrl: string) => putValue(PHOTOS_STORE, sideId, dataUrl),
    []
  );

  const loadPhoto = useCallback(
    (sideId: string) => getValue<string>(PHOTOS_STORE, sideId),
    []
  );

  const deletePhoto = useCallback(
    (sideId: string) => deleteKey(PHOTOS_STORE, sideId),
    []
  );

  const loadAllPhotos = useCallback(async (sideIds: string[]): Promise<Record<string, string>> => {
    const entries = await Promise.all(
      sideIds.map(async (id) => [id, await getValue<string>(PHOTOS_STORE, id)] as const)
    );
    const result: Record<string, string> = {};
    for (const [id, value] of entries) {
      if (value) result[id] = value;
    }
    return result;
  }, []);

  const clearAllPhotos = useCallback(() => clearStore(PHOTOS_STORE), []);

  const saveRender = useCallback(
    (cacheKey: string, dataUrl: string) => putValue(RENDERS_STORE, cacheKey, dataUrl),
    []
  );

  const loadRender = useCallback(
    (cacheKey: string) => getValue<string>(RENDERS_STORE, cacheKey),
    []
  );

  const clearAllRenders = useCallback(() => clearStore(RENDERS_STORE), []);

  return {
    savePhoto,
    loadPhoto,
    deletePhoto,
    loadAllPhotos,
    clearAllPhotos,
    saveRender,
    loadRender,
    clearAllRenders,
  };
}
