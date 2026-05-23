import { Router } from "express";
import { getServerDb } from "../services/db";
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "firebase/firestore";

export const auditRouter = Router();

// Endpoint for the React client to post custom high-integrity audit logs
auditRouter.post("/audit/log", async (req, res) => {
  try {
    const { operatorEmail, operatorUid, action, targetId, details } = req.body;
    
    const db = getServerDb();
    if (!db) {
      return res.status(500).json({ error: "Firestore server connection unavailable" });
    }

    const auditRef = collection(db, "role_audit");
    const docRef = await addDoc(auditRef, {
      operatorEmail: operatorEmail || "sistema@stockflow.com",
      operatorUid: operatorUid || "sys-cron",
      action: action || "SYSTEM_EVENT",
      targetId: targetId || "N/A",
      details: details || {},
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      timestamp: serverTimestamp()
    });

    res.json({ success: true, id: docRef.id });
  } catch (err: any) {
    console.error("Failed to write audit log:", err);
    res.status(500).json({ error: "Fallo al escribir registro de auditoría." });
  }
});

// Secure API endpoint to fetch audit logs for the Admin "Historial de Auditoría" panel
auditRouter.get("/audit/logs", async (req, res) => {
  try {
    const db = getServerDb();
    if (!db) {
      return res.status(500).json({ error: "Firestore server connection unavailable" });
    }

    // High performance index-sorted query
    const auditRef = collection(db, "role_audit");
    const q = query(auditRef, orderBy("timestamp", "desc"), limit(40));
    const snap = await getDocs(q);
    
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
      const db = getServerDb();
      if (!db) throw new Error();
      const snap = await getDocs(collection(db, "role_audit"));
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
    isTarget = true;
    actionName = "ROLE_OR_USER_MUTATION";
  }

  if (isTarget && ["POST", "PUT", "DELETE"].includes(req.method)) {
    res.json = function (data: any) {
      res.json = originalJson;
      const db = getServerDb();
      if (db) {
        addDoc(collection(db, "role_audit"), {
          operatorEmail: req.headers["x-operator-email"] || req.query.operatorEmail || "api-gateway@stockflow.com",
          operatorUid: req.headers["x-operator-uid"] || req.query.operatorUid || "gateway-token",
          action: actionName,
          targetId: req.params.id || req.body.id || "payload-body",
          details: {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            body: req.body ? { ...req.body, password: undefined } : {}
          },
          ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
          timestamp: serverTimestamp()
        }).catch(e => console.error("[expressAuditMiddleware] Logging failed:", e));
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
