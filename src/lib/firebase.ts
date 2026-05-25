import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Safe messaging instance
let messagingInstance: Messaging | null = null;
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  isSupported()
    .then((supported) => {
      if (supported) {
        messagingInstance = getMessaging(app);
        console.log("⚡ [Firebase] Messaging service initialized successfully.");
      }
    })
    .catch((e) => {
      console.warn("⚠️ [Firebase] Messaging not supported or restricted in this environment:", e);
    });
}

export function getMessagingInstance(): Messaging | null {
  return messagingInstance;
}

// Test connection as per critical directive
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawMsg = error instanceof Error ? error.message : String(error);
  
  // Helper to mask email address to avoid leaking user PII
  const maskEmail = (email?: string | null): string | null => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return "***";
    const [local, domain] = parts;
    const mLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : "***";
    const mDomain = domain.length > 2 ? `${domain[0]}***${domain[domain.length - 1]}` : "***";
    return `${mLocal}@${mDomain}`;
  };

  // Helper to mask user ID
  const maskUserId = (uid?: string | null): string | null => {
    if (!uid) return null;
    return uid.length > 6 ? `${uid.slice(0, 3)}***${uid.slice(-3)}` : "***";
  };

  // Clean raw error message of direct project keys, endpoints or database identifiers
  let cleanMsg = rawMsg
    .replace(/[a-zA-Z0-9_-]{30,}/g, "[SECRET-KEY-OR-ID]") // Mask potential keys or long hash segments
    .replace(/ais-dev-[a-z0-9]+/g, "[PROD-ENV-ID]")       // Mask raw environment tags
    .replace(/[a-zA-Z0-9.-]+\.run\.app/g, "[CLUSTER-URL]"); // Mask actual host URLs

  const errInfo = {
    error: cleanMsg,
    authInfo: {
      userId: maskUserId(auth.currentUser?.uid),
      email: maskEmail(auth.currentUser?.email),
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: maskEmail(provider.email),
        })) || [],
    },
    operationType,
    path: path ? path.replace(/[^a-zA-Z0-9_.-]/g, "") : null, // keep path name safe
  };

  // Log a clean, redacted version inside console
  console.warn(`[Security Sanitized Document Error] Operation: ${operationType}, Path: ${path || "Unknown"}`, errInfo);

  // Throw a human-friendly, localized message that doesn't leak raw JSON dump to the UI.
  let userFriendlyMsg = "Ha ocurrido un error al procesar la solicitud en la base de datos.";
  if (cleanMsg.toLowerCase().includes("permission-denied") || cleanMsg.toLowerCase().includes("permission_denied") || cleanMsg.toLowerCase().includes("insufficient permissions")) {
    userFriendlyMsg = `No tienes permisos suficientes para realizar esta acción (${operationType} en ${path || "recurso"}).`;
  } else if (cleanMsg.toLowerCase().includes("offline") || cleanMsg.toLowerCase().includes("network")) {
    userFriendlyMsg = "Error de conexión. Por favor comprueba si estás conectado a internet.";
  }

  throw new Error(userFriendlyMsg);
}
