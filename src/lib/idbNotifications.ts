import { STORAGE_KEYS, getStorageJSON, setStorageJSON } from "./storage";

const NOTIFICATION_DB_NAME = "Notification_Settings_DB";
const NOTIFICATION_DB_VERSION = 1;
const NOTIFICATION_STORE_NAME = "push_configs";

export interface PushNotificationConfig {
  id: string; // usually "user_push_config"
  criticalStockAlerts: boolean;
  orderAlerts: boolean;
  browserPermission: string;
  updatedAt: string;
}

function getNotificationDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = indexedDB.open(NOTIFICATION_DB_NAME, NOTIFICATION_DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(NOTIFICATION_STORE_NAME)) {
        db.createObjectStore(NOTIFICATION_STORE_NAME, { keyPath: "id" });
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

export async function getPushConfig(): Promise<PushNotificationConfig> {
  const defaultConfig: PushNotificationConfig = {
    id: "user_push_config",
    criticalStockAlerts: true,
    orderAlerts: true,
    browserPermission: typeof Notification !== "undefined" ? Notification.permission : "default",
    updatedAt: new Date().toISOString()
  };

  try {
    const db = await getNotificationDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(NOTIFICATION_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTIFICATION_STORE_NAME);
      const request = store.get("user_push_config");
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          resolve(defaultConfig);
        }
      };
      request.onerror = () => {
        resolve(defaultConfig);
      };
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in getPushConfig, using defaults:", err);
    return getStorageJSON<PushNotificationConfig>(STORAGE_KEYS.pushNotificationConfig, defaultConfig);
  }
}

export async function savePushConfig(config: Partial<PushNotificationConfig>): Promise<PushNotificationConfig> {
  const current = await getPushConfig();
  const updated: PushNotificationConfig = {
    ...current,
    ...config,
    id: "user_push_config",
    updatedAt: new Date().toISOString()
  };

  try {
    const db = await getNotificationDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(NOTIFICATION_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTIFICATION_STORE_NAME);
      const request = store.put(updated);
      request.onsuccess = () => {
        setStorageJSON(STORAGE_KEYS.pushNotificationConfig, updated);
        resolve(updated);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("⚠️ IndexedDB error in savePushConfig, falling back to localStorage:", err);
    setStorageJSON(STORAGE_KEYS.pushNotificationConfig, updated);
    return updated;
  }
}
