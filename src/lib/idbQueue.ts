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
    try {
      const cached = localStorage.getItem("pos_offline_queue");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
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
    try {
      localStorage.setItem("pos_offline_queue", JSON.stringify(sales));
    } catch (e) {
      console.error(e);
    }
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
    try {
      const cached = localStorage.getItem("pos_offline_queue");
      const queue = cached ? JSON.parse(cached) : [];
      queue.push(sale);
      localStorage.setItem("pos_offline_queue", JSON.stringify(queue));
    } catch (e) {
      console.error(e);
    }
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
    try {
      const cached = localStorage.getItem("pos_offline_queue");
      const queue = cached ? JSON.parse(cached) : [];
      const filtered = queue.filter((item: any) => item.orderId !== orderId);
      localStorage.setItem("pos_offline_queue", JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }
}
