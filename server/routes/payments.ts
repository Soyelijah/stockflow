import { Router, Response } from "express";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { z } from "zod";
import { requireAuthBearer, AuthenticatedRequest } from "../services/security";

export const paymentsRouter = Router();

// FLOW GLOBAL CONFIGURATIONS
const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
const FLOW_ENVIRONMENT = (process.env.FLOW_ENVIRONMENT || "sandbox").toLowerCase();

const FLOW_URL = FLOW_ENVIRONMENT === "production" 
  ? "https://www.flow.cl/api" 
  : "https://sandbox.flow.cl/api";

console.log(`[Modular Payments Router] Flow initialized on: ${FLOW_ENVIRONMENT}`);

// MERCADO PAGO GLOBAL CONFIGURATIONS
const mpClient = process.env.MERCADOPAGO_ACCESS_TOKEN 
  ? new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 5000 } })
  : null;

/**
 * Calculador de Firmas HMAC-SHA256 para validaciones de seguridad de API Flow
 */
function getFlowSignature(params: Record<string, any>) {
  const keys = Object.keys(params).sort();
  const query = keys.map(key => `${key}=${params[key]}`).join("&");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(query).digest("hex");
}

/**
 * Verifica la firma HMAC de los webhooks de Mercado Pago
 */
function verifyMPSignature(req: any): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[verifyMPSignature] WARNING: MP_WEBHOOK_SECRET is not configured. Webhook signature check is bypassed.");
    return true;
  }

  const xSig = req.headers['x-signature'] as string;
  const xReqId = req.headers['x-request-id'] as string;
  if (!xSig || !xReqId) return false;
  
  try {
    const parts = Object.fromEntries(xSig.split(',').map(p => p.trim().split('=')));
    const ts = parts.ts;
    const v1 = parts.v1;
    const dataId = req.query['data.id'] || req.body?.data?.id;
    
    if (!ts || !v1 || !dataId) return false;
    
    const manifest = `id:${dataId};request-id:${xReqId};ts:${ts};`;
    const computed = crypto.createHmac('sha256', secret)
                            .update(manifest).digest('hex');
                            
    const v1Buffer = Buffer.from(v1);
    const computedBuffer = Buffer.from(computed);
    if (v1Buffer.length !== computedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(v1Buffer, computedBuffer);
  } catch (err) {
    console.error("[verifyMPSignature] Error parsing signature:", err);
    return false;
  }
}

// Zod schemas for input validation
const MPProcessSchema = z.object({
  token: z.string().min(5),
  issuer_id: z.any().optional(),
  payment_method_id: z.string().min(1),
  transaction_amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  installments: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  description: z.string().max(250).optional(),
  payer: z.object({
    email: z.string().email()
  })
});

const FlowCreatePaymentSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  email: z.string().email(),
  description: z.string().max(250),
  externalId: z.string().max(100),
  baseUrl: z.string().url()
});

/* ==========================================
   ROUTE: Mercado Pago Process
   ========================================== */
paymentsRouter.post("/mercadopago/process-payment", requireAuthBearer as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mpClient) {
      throw new Error("Mercado Pago no está configurado o requiere credenciales secretas.");
    }

    const parsed = MPProcessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.format() });
    }

    const { token, issuer_id, payment_method_id, transaction_amount, installments, description, payer } = parsed.data;
    
    const payment = new Payment(mpClient);
    const result = await payment.create({
      body: {
        transaction_amount: transaction_amount,
        token,
        description: description || "Venta POS StockFlow",
        installments: installments,
        payment_method_id,
        issuer_id: issuer_id ? Number(issuer_id) : undefined,
        payer,
        notification_url: `${req.protocol}://${req.get("host")}/api/payments/mercadopago/webhook`
      }
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error("[Payments MP ERROR]:", err);
    res.status(500).json({ error: err.message || "Error al procesar el pago con Mercado Pago" });
  }
});

paymentsRouter.post("/mercadopago/webhook", async (req, res) => {
  if (!verifyMPSignature(req)) {
    return res.status(401).json({ error: "Firma inválida del webhook de Mercado Pago" });
  }

  const { action, data } = req.body;
  if (action === "payment.created" || action === "payment.updated") {
    console.log(`[Webhook] Mercado Pago status push received for ID: ${data?.id}`);
  }
  res.sendStatus(200);
});

/* ==========================================
   ROUTE: Flow Chile Create Payment Link
   ========================================== */
paymentsRouter.post("/flow/create-payment", async (req, res) => {
  try {
    const parsed = FlowCreatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.format() });
    }

    const { amount, email, description, externalId, baseUrl } = parsed.data;

    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      throw new Error("FLOW_API_KEY y/o FLOW_SECRET_KEY no se encuentran declarados.");
    }

    const cleanAmount = Math.round(amount);

    const params: Record<string, any> = {
      apiKey: FLOW_API_KEY,
      commerceOrder: externalId,
      subject: description,
      amount: cleanAmount,
      currency: "CLP",
      email: email,
      urlConfirmation: `${baseUrl}/api/payments/flow/confirm`,
      urlReturn: `${baseUrl}/flow-result`,
    };

    const s = getFlowSignature(params);
    const formData = new URLSearchParams();
    Object.keys(params).forEach(key => formData.append(key, params[key]));
    formData.append("s", s);

    const response = await fetch(`${FLOW_URL}/payment/create`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.token) {
      res.json({ 
        url: `${data.url}?token=${data.token}`,
        token: data.token
      });
    } else {
      console.error("[Payments] Flow direct response error:", data);
      res.status(400).json({ error: data.message || "Error devuelto por el servidor de Flow" });
    }
  } catch (err: any) {
    console.error("[Payments Flow ERROR]:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================
   ROUTE: Flow Chile Webhook Confirmation Handler
   ========================================== */
paymentsRouter.post("/flow/confirm", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") return res.status(400).send("No token");

    // Verify payment authenticity and parse status with Flow endpoints
    const params = {
      apiKey: FLOW_API_KEY,
      token: token
    };
    
    const s = getFlowSignature(params);
    const query = new URLSearchParams({ ...params, s }).toString();
    
    const response = await fetch(`${FLOW_URL}/payment/getStatus?${query}`);
    const statusData = await response.json();

    console.log("[Payments Confirmation Webhook]:", statusData);
    
    res.send("ok");
  } catch (err) {
    console.error("[Payments Confirmation ERROR]:", err);
    res.status(500).send("error");
  }
});

/* ==========================================
   ROUTE: Flow Chile Instant Check Status
   ========================================== */
paymentsRouter.get("/flow/payment-status", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") return res.status(400).json({ error: "No token supplied in query params" });

    const params = {
      apiKey: FLOW_API_KEY,
      token: token
    };
    
    const s = getFlowSignature(params);
    const query = new URLSearchParams({ ...params, s }).toString();
    
    const response = await fetch(`${FLOW_URL}/payment/getStatus?${query}`);
    const statusData = await response.json();

    res.json(statusData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function healthCheck() {
  const isMPActive = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  const isFlowActive = Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY);
  return {
    status: isMPActive || isFlowActive ? "online" : "offline",
    details: {
      mercadopago: isMPActive ? "configured" : "missing_credentials",
      flow: isFlowActive ? "configured" : "missing_credentials",
      flowEnvironment: process.env.FLOW_ENVIRONMENT || "sandbox"
    }
  };
}
