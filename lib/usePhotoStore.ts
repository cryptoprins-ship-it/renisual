import { useCallback } from "react";

const DB_NAME = "renisual-photos";
const STORE_NAME = "photos";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function usePhotoStore() {
  const savePhoto = useCallback(async (sideId: string, dataUrl: string): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, sideId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  const loadPhoto = useCallback(async (sideId: string): Promise<string | null> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(sideId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }, []);

  const deletePhoto = useCallback(async (sideId: string): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(sideId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  const loadAllPhotos = useCallback(async (sideIds: string[]): Promise<Record<string, string>> => {
    const db = await openDb();
    const result: Record<string, string> = {};
    await Promise.all(
      sideIds.map(
        (id) =>
          new Promise<void>((resolve, reject) => {
            const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
            req.onsuccess = () => {
              if (req.result) result[id] = req.result;
              resolve();
            };
            req.onerror = () => reject(req.error);
          })
      )
    );
    return result;
  }, []);

  const clearAllPhotos = useCallback(async (): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  return { savePhoto, loadPhoto, deletePhoto, loadAllPhotos, clearAllPhotos };
}
