import { Router } from "express";
import { adminDb } from "../services/firebaseAdmin";
import * as admin from "firebase-admin";
import { requireAuthBearer, AuditLogSchema, AuthenticatedRequest } from "../services/security";

export const auditRouter = Router();

type AuditLogPayload = {
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
};

export function buildAuditLogRecord(
  parsed: AuditLogPayload,
  user: AuthenticatedRequest["user"],
  ipAddress: string
) {
  const { action, targetId, details } = parsed;

  return {
    operatorEmail: user?.email || "sistema@stockflow.com",
    operatorUid: user?.uid || "sys-cron",
    action,
    targetId,
    details: details || {},
    ipAddress,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };
}

// Endpoint for the React client to post custom high-integrity audit logs
auditRouter.post("/audit/log", requireAuthBearer as any, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate payload with Zod
    const parsed = AuditLogSchema.parse(req.body);

    const docRef = await adminDb.collection("role_audit").add(buildAuditLogRecord(
      parsed,
      req.user,
      req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1"
    ));

    res.json({ success: true, id: docRef.id });
  } catch (err: any) {
    console.error("Failed to write audit log:", err);
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Datos de auditoría inválidos", details: err.errors });
    } else {
      res.status(500).json({ error: "Fallo al escribir registro de auditoría." });
    }
  }
});

// Secure API endpoint to fetch audit logs for the Admin "Historial de Auditoría" panel
auditRouter.get("/audit/logs", requireAuthBearer as any, async (req: AuthenticatedRequest, res) => {
  try {
    // High performance index-sorted query via adminDb
    const snap = await adminDb.collection("role_audit")
      .orderBy("timestamp", "desc")
      .limit(40)
      .get();
    
    const logs = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
      };
    });

    res.json({ success: true, logs });
  } catch (err: any) {
    console.warn("Audit logs retrieval failed. Trying fallback list:", err);
    try {
      const snap = await adminDb.collection("role_audit").get();
      const logs = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
        };
      }).sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      res.json({ success: true, logs });
    } catch (inner) {
      console.error("Full audit query fallback failed:", inner);
      res.status(500).json({ error: "Fallo al consultar los registros de auditoría." });
    }
  }
});

// Automated Audit Logging Middleware for Express routes modifying role-level data and expenses
export async function expressAuditMiddleware(req: any, res: any, next: any) {
  // Capture responses for targeted POST/PUT/DELETE triggers on sensitive endpoints
  const originalJson = res.json;
  let isTarget = false;
  let actionName = "API_REQUEST";

  const path = req.path.toLowerCase();
  
  if (path.includes("/expense")) {
    isTarget = true;
    actionName = req.method === "POST" ? "EXPENSE_CREATED" : req.method === "DELETE" ? "EXPENSE_DELETED" : "EXPENSE_MODIFIED";
  } else if (path.includes("/role") || path.includes("/user")) {
    isTarget = true;
    actionName = "ROLE_OR_USER_MUTATION";
  }

  if (isTarget && ["POST", "PUT", "DELETE"].includes(req.method)) {
    res.json = function (data: any) {
      res.json = originalJson;
      
      // H-SAN-5: sanitize headers/query/params before writing to immutable audit log.
      const safeEmail = (val: unknown, fallback: string): string => {
        if (typeof val !== "string") return fallback;
        const trimmed = val.trim().toLowerCase().slice(0, 254);
        return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(trimmed) ? trimmed : fallback;
      };
      const safeId = (val: unknown, fallback: string, max = 128): string => {
        if (typeof val !== "string") return fallback;
        const trimmed = val.trim().slice(0, max);
        return /^[A-Za-z0-9_\-:.]+$/.test(trimmed) ? trimmed : fallback;
      };

      adminDb.collection("role_audit").add({
        operatorEmail: safeEmail(req.headers["x-operator-email"] || req.query.operatorEmail, "api-gateway@stockflow.com"),
        operatorUid: safeId(req.headers["x-operator-uid"] || req.query.operatorUid, "gateway-token"),
        action: actionName,
        targetId: safeId(req.params.id || req.body?.id, "payload-body"),
        details: {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          body: req.body ? { ...req.body, password: undefined } : {}
        },
        ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }).catch(e => console.error("[expressAuditMiddleware] Logging failed:", e));

      return originalJson.apply(this, arguments);
    };
  }

  next();
}

// Module health diagnostics
export function healthCheck() {
  return {
    status: "online",
    details: {
      registeredCollections: ["role_audit"],
      intercomMiddlewareActive: true
    }
  };
}
