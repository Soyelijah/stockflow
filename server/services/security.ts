import { Request, Response, NextFunction } from "express";
import admin from "./firebaseAdmin";
import { z } from "zod";

function getFirebaseAdmin(): typeof admin | null {
  const hasCredentials = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!hasCredentials) {
    // Fallback for demo or local dev environment when server keys aren't provisioned yet
    return null;
  }
  return admin;
}

// Extends Request interface to attach authenticated user info
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    role?: string;
  };
}

/**
 * Bearer Token Middleware to authenticate calls via Firebase ID Tokens.
 * Fallbacks gracefully in local sandbox development if credentials are empty to keep development responsive.
 */
export async function requireAuthBearer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acceso denegado. Se requiere Token de Autorización Bearer." });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "Token malformado en la cabecera Authorization." });
  }

  const adminClient = getFirebaseAdmin();

  if (adminClient) {
    try {
      const decodedToken = await adminClient.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name || (decodedToken.email ? decodedToken.email.split("@")[0] : "Operador")
      };
      return next();
    } catch (err: any) {
      console.error("🔑 [Security Authorization Failed]:", err.message);
      return res.status(401).json({ error: "Token de sesión inválido o expirado." });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Servicio de autenticación no disponible en producción." });
    }
    // Graceful fallback for local developer sandbox without Firebase Service Account credentials.
    // Minimizes friction while ensuring that a structural Authorization header is still present.
    try {
      // In local dev without keys, we permit decoding the token header if it's a mock token
      // or we extract simulated credentials from the JWT payload without cryptographic signature verify.
      if (token.includes(".")) {
        const payloadBase64 = token.split(".")[1];
        if (payloadBase64) {
          const decodedPayload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
          req.user = {
            uid: decodedPayload.uid || decodedPayload.user_id || "mock-uid-123",
            email: decodedPayload.email || "demo-operator@stockflow.com",
            email_verified: true,
            name: decodedPayload.name || "Operador Local"
          };
          console.log(`ℹ️ [Security] Decoded simulated operator log in Local Environment: ${req.user.email}`);
          return next();
        }
      }
      
      // Default fallback mock-user when token is client-supplied identifier for UI testing
      req.user = {
        uid: token,
        email: req.headers["x-operator-email"] as string || "cajero-demo@stockflow.com",
        email_verified: true,
        name: "Cajero Test"
      };
      console.log(`ℹ️ [Security] Fallback credentials bound to Local request from Bearer Token: ${token}`);
      return next();
    } catch (err) {
      return res.status(401).json({ error: "No se pudo validar el Token en el sandbox local." });
    }
  }
}

// Zod validation schemas to prevent parameter inject or schema breaches
export const SendReceiptSchema = z.object({
  customerEmail: z.string().email("Correo de cliente inválido"),
  orderDetails: z.object({
    orderId: z.string(),
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number().positive(),
      price: z.number().nonnegative(),
      costPrice: z.number().optional()
    })),
    total: z.number().nonnegative(),
    tax: z.number().nonnegative().optional(),
    discountApplied: z.number().nonnegative().optional(),
    finalTotal: z.number().nonnegative()
  }),
  businessName: z.string().min(2, "Nombre de negocio muy corto"),
  lang: z.enum(["es", "en"]).optional().default("es")
});

export const ShrinkagePdfSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1, "Nombre de producto requerido"),
    stockActual: z.number().nonnegative(),
    stockFisico: z.number().nonnegative(),
    motive: z.string().optional()
  })),
  responsible: z.string().optional(),
  comments: z.string().optional(),
  isHistorical: z.boolean().optional().default(false),
  lang: z.enum(["es", "en"]).optional().default("es")
});

export const AuditLogSchema = z.object({
  operatorEmail: z.string().email("Correo de operador inválido").optional(),
  operatorUid: z.string().min(5, "UID de operador inválido").optional(),
  action: z.string().min(3, "Acción de auditoría no especificada"),
  targetId: z.string().min(1, "ID objetivo requerido"),
  details: z.record(z.string(), z.any()).optional()
});
