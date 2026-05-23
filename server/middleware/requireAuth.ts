import { Request, Response, NextFunction } from "express";
import { admin } from "../services/firebaseAdmin";

export interface AuthenticatedRequest extends Request {
  user?: any; // Decoded ID Token payload
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing or malformed Bearer token." });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err: any) {
    console.warn("[requireAuth] Token verification failed:", err.message || err);
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }
}
