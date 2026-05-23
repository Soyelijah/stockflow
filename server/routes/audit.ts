import { Router, Response } from "express";
import { admin } from "../services/firebaseAdmin";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

export const auditRouter = Router();

// Endpoint for the React client to post custom high-integrity audit logs
// Security: Requires Bearer Auth and Admin/Owner role. Extract operator identity from verified token.
auditRouter.post("/audit/log", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role || "customer";
    if (!["admin", "owner"].includes(role)) {
      return res.status(403).json({ error: "Forbidden. Insufficient permissions to post audit logs." });
    }

    const { action, targetId, details } = req.body;
    
    // Strict whitelist of actions to prevent arbitrary log injection
    const ALLOWED_ACTIONS = [
      "ROLE_CHANGE", 
      "EXPENSE_CREATED", 
      "EXPENSE_DELETED", 
      "EXPENSE_MODIFIED",
      "role_change",
      "manual_override",
      "data_export",
      "config_change"
    ];
    
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Invalid or unauthorized action." });
    }

    const db = admin.firestore();
    const docRef = await db.collection("role_audit").add({
      operatorEmail: req.user?.email || "sistema@stockflow.com",
      operatorUid: req.user?.uid || "sys-cron",
      action: action,
      targetId: targetId || "N/A",
      details: details || {},
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, id: docRef.id });
  } catch (err: any) {
    console.error("Failed to write audit log:", err);
    res.status(500).json({ error: "Fallo al escribir registro de auditoría." });
  }
});

// Secure API endpoint to fetch audit logs for the Admin "Historial de Auditoría" panel
// Security: Requires Bearer Auth and Admin/Owner role.
auditRouter.get("/audit/logs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role || "customer";
    if (!["admin", "owner"].includes(role)) {
      return res.status(403).json({ error: "Forbidden. Insufficient permissions to read audit logs." });
    }

    const limitCount = Math.min(Number(req.query.limit) || 40, 100);

    const db = admin.firestore();
    const snap = await db.collection("role_audit")
      .orderBy("timestamp", "desc")
      .limit(limitCount)
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
      const db = admin.firestore();
      const snap = await db.collection("role_audit").get();
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
    res.json = async function (data: any) {
      res.json = originalJson;
      
      let operatorEmail = "api-gateway@stockflow.com";
      let operatorUid = "gateway-token";

      // Attempt to extract verified user identity from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.split("Bearer ")[1];
          const decoded = await admin.auth().verifyIdToken(token);
          operatorEmail = decoded.email || operatorEmail;
          operatorUid = decoded.uid || operatorUid;
        } catch (e) {
          // Silent fallback to headers/query for non-blocking audit logging
          operatorEmail = req.headers["x-operator-email"] || req.query.operatorEmail || operatorEmail;
          operatorUid = req.headers["x-operator-uid"] || req.query.operatorUid || operatorUid;
        }
      } else {
        operatorEmail = req.headers["x-operator-email"] || req.query.operatorEmail || operatorEmail;
        operatorUid = req.headers["x-operator-uid"] || req.query.operatorUid || operatorUid;
      }

      try {
        const db = admin.firestore();
        await db.collection("role_audit").add({
          operatorEmail,
          operatorUid,
          action: actionName,
          targetId: req.params.id || req.body.id || "payload-body",
          details: {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            body: req.body ? { ...req.body, password: undefined } : {}
          },
          ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error("[expressAuditMiddleware] Logging failed:", e);
      }
      
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
