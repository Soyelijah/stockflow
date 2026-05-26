const STORAGE_VERSION = "v1";

// Tier 5.A4.2: `customerSession` key removed — customer auth now lives in Firebase Auth,
// not localStorage. Any legacy `customer_session` key still on a returning user's device
// is harmless garbage that the browser will GC; no migration shim needed.
export const STORAGE_KEYS = {
  pendingOrderCart: "pending_order_cart",
  pendingOrderPayments: "pending_order_payments",
  pendingOrderCoupon: "pending_order_coupon",
  dismissedClaims: "dismissed_claims",
  readNotificationIds: "read_notification_ids",
  dismissedNotificationIds: "dismissed_notification_ids",
  posActiveCart: "pos_active_cart",
  posActiveCartStandard: "pos_active_cart_standard",
  posRegisterOpen: "pos_register_open",
  posShiftData: "pos_shift_data",
  posModeOffline: "pos_mode_offline",
  posOfflineQueue: "pos_offline_queue",
  pushNotificationConfig: "push_notification_config",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function versioned(key: StorageKey): string {
  return `${key}:${STORAGE_VERSION}`;
}

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getStorageJSON<T>(key: StorageKey, fallback: T): T {
  if (!isStorageAvailable()) return fallback;
  try {
    const current = window.localStorage.getItem(versioned(key));
    if (current !== null) return JSON.parse(current) as T;
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) {
      window.localStorage.setItem(versioned(key), legacy);
      window.localStorage.removeItem(key);
      return JSON.parse(legacy) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function getStorageString(key: StorageKey): string | null {
  if (!isStorageAvailable()) return null;
  try {
    const current = window.localStorage.getItem(versioned(key));
    if (current !== null) return current;
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) {
      window.localStorage.setItem(versioned(key), legacy);
      window.localStorage.removeItem(key);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStorageJSON(key: StorageKey, value: unknown): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(versioned(key), JSON.stringify(value));
  } catch {
    // quota exceeded, private mode, etc. — silent fail
  }
}

export function setStorageString(key: StorageKey, value: string): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(versioned(key), value);
  } catch {
    // noop
  }
}

export function removeStorage(key: StorageKey): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(versioned(key));
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}
