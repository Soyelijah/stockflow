import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance } from "./firebase";

/**
 * Requests notification permission, registers the FCM service worker statically,
 * retrieves the registration token, and indexes it in the Firestore 'fcm_tokens' collection.
 */
export async function requestFCMToken(userId: string, role: "driver" | "customer" | "admin"): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.warn("[FCM Client] Service workers or window environment not viable.");
    return null;
  }

  if (!("Notification" in window)) {
    console.warn("[FCM Client] Desktop notification API is not supported in this browser.");
    return null;
  }

  try {
    // 1. Ask user for notification prompt
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM Client] Permission for push notifications has been denied by the user.");
      return null;
    }

    // 2. Explicitly register FCM Service Worker for clean sandbox isolation
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("[FCM Client] Push Service Worker registered with scope:", registration.scope);
    } catch (swError) {
      console.error("[FCM Client] Service worker initialization failed:", swError);
      return null;
    }

    // 3. Make sure messaging instance is set
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.info("[FCM Client] FCM Messaging core is unavailable (possible in iframe preview restrictions).");
      return null;
    }

    // 4. Retrieve push token using client registration instance
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log(`[FCM Client] Token verified successfully: ${token.slice(0, 10)}...`);

      // 5. Index token mapping inside our database
      const fcmRef = doc(db, "fcm_tokens", token);
      await setDoc(fcmRef, {
        token,
        userId,
        role,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log("[FCM Client] Token indexed inside 'fcm_tokens' collection.");
      return token;
    } else {
      console.warn("[FCM Client] Received empty token registration check.");
      return null;
    }
  } catch (error) {
    console.warn("[FCM Client] FCM setup skipped or restricted (expected inside local iframes):", error);
    return null;
  }
}

/**
 * Attaches real-time listeners for processing foreground push warnings when active in browser.
 */
export function listenToForegroundMessages(onMessageReceived?: (payload: any) => void) {
  if (typeof window === "undefined") return;

  const messaging = getMessagingInstance();
  if (!messaging) return;

  try {
    return onMessage(messaging, (payload) => {
      console.log("📬 [FCM Client] Received foreground notification:", payload);
      
      // Execute custom callback if provided
      if (onMessageReceived) {
        onMessageReceived(payload);
      }

      // Fallback: standard browser notify if user has given permission
      if (Notification.permission === "granted" && payload.notification) {
        try {
          new Notification(payload.notification.title || "StockFlow Pro", {
            body: payload.notification.body,
            icon: "/logo.png"
          });
        } catch (e) {
          console.warn("[FCM Client] Failed to spawn HTML5 Notification constructor:", e);
        }
      }
    });
  } catch (err) {
    console.warn("[FCM Client] Foreground hook initialization warn:", err);
  }
}
