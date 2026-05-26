import { STORAGE_KEYS, getStorageJSON, setStorageJSON } from "./storage";

const DB_NAME = "POS_Offline_DB";
const DB_VERSION = 1;
const STORE_NAME = "offline_sales";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "orderId" });
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function getOfflineSales(): Promise<any[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in getOfflineSales, falling back to localStorage:", err);
    return getStorageJSON<any[]>(STORAGE_KEYS.posOfflineQueue, []);
  }
}

export async function saveAllOfflineSales(sales: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => {
        if (sales.length === 0) {
          resolve();
          return;
        }
        let count = 0;
        let hasError = false;
        sales.forEach((sale) => {
          const rq = store.put(sale);
          rq.onerror = () => {
            if (!hasError) {
              hasError = true;
              reject(rq.error);
            }
          };
          rq.onsuccess = () => {
            count++;
            if (count === sales.length && !hasError) {
              resolve();
            }
          };
        });
      };
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in saveAllOfflineSales, falling back to localStorage:", err);
    setStorageJSON(STORAGE_KEYS.posOfflineQueue, sales);
  }
}

export async function addOfflineSale(sale: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(sale);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in addOfflineSale, falling back to localStorage:", err);
    const queue = getStorageJSON<any[]>(STORAGE_KEYS.posOfflineQueue, []);
    queue.push(sale);
    setStorageJSON(STORAGE_KEYS.posOfflineQueue, queue);
  }
}

export async function deleteOfflineSale(orderId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(orderId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in deleteOfflineSale, falling back to localStorage:", err);
    const queue = getStorageJSON<any[]>(STORAGE_KEYS.posOfflineQueue, []);
    const filtered: any[] = [];
    for (const item of queue) {
      if (item.orderId !== orderId) filtered.push(item);
    }
    setStorageJSON(STORAGE_KEYS.posOfflineQueue, filtered);
  }
}
