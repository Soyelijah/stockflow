import { Router } from "express";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { z } from "zod";
import { emitElectronicBoleta } from "../services/boletaService";
import { requireAuthBearer, AuthenticatedRequest } from "../services/security";

export const paymentsRouter = Router();

// ZOD INPUT SECURITY SCHEMAS
const MercadoPagoPaymentSchema = z.object({
  token: z.string().min(1, "Token de pago requerido"),
  issuer_id: z.union([z.string(), z.number()]).transform(val => Number(val)).optional(),
  payment_method_id: z.string().min(1, "Método de pago requerido"),
  transaction_amount: z.union([z.number(), z.string()]).transform(val => Number(val)),
  installments: z.union([z.number(), z.string()]).transform(val => Number(val)).default(1),
  description: z.string().optional(),
  payer: z.object({
    email: z.string().email("Correo de pagador inválido"),
    identification: z.object({
      type: z.string().optional(),
      number: z.string().optional()
    }).optional()
  })
});

const FlowCreatePaymentSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform(val => Math.round(Number(val))),
  email: z.string().email("Correo de cliente inválido"),
  description: z.string().min(1, "Descripción del cobor requerida"),
  externalId: z.string().min(1, "ID de orden externo requerido"),
  baseUrl: z.string().url("URL de retorno inválida")
});

const FlowPaymentStatusSchema = z.object({
  token: z.string().min(1, "Token de consulta de Flow requerido")
});

const EmisionManualSchema = z.object({
  orderId: z.string().min(1),
  amount: z.union([z.number(), z.string()]).transform(val => Math.round(Number(val))),
  buyerEmail: z.string().email(),
  customerName: z.string().optional(),
  customerTaxId: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.union([z.number(), z.string()]).transform(val => Number(val)),
    price: z.union([z.number(), z.string()]).transform(val => Number(val))
  })).optional(),
  gateway: z.string().optional()
});

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

/* ==========================================
   ROUTE: Mercado Pago Process
   ========================================== */
function verifyMPSignature(req: any): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[verifyMPSignature] ERROR: MP_WEBHOOK_SECRET no está configurado en producción. Rechazando webhook.");
      return false;
    }
    console.warn("[verifyMPSignature] WARNING: MP_WEBHOOK_SECRET no configurado. Bypasseando firma en dev.");
    return true;
  }

  const signatureHeader = req.headers["x-signature"];
  if (!signatureHeader) {
    console.error("[verifyMPSignature] Missing x-signature header.");
    return false;
  }

  try {
    const parts = String(signatureHeader).split(",");
    let ts = "";
    let v1 = "";
    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k === "ts") ts = v;
      if (k === "v1") v1 = v;
    }

    if (!ts || !v1) {
      console.error("[verifyMPSignature] Invalid x-signature header structure.");
      return false;
    }

    const dataId = req.query["data.id"] || req.body?.data?.id || "";
    const manifest = `id:${dataId};request-id:${req.headers["x-request-id"] || ""};ts:${ts};`;
    const calculated = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    if (calculated === v1) {
      return true;
    }
    console.error("[verifyMPSignature] Signature mismatch.");
    return false;
  } catch (err) {
    console.error("[verifyMPSignature] Error validating signature:", err);
    return false;
  }
}

paymentsRouter.post("/mercadopago/process-payment", async (req, res) => {
  try {
    if (!mpClient) {
      throw new Error("Mercado Pago no está configurado o requiere credenciales secretas.");
    }

    // Validate input with Zod Schema
    const parsed = MercadoPagoPaymentSchema.parse(req.body);
    const { token, issuer_id, payment_method_id, transaction_amount, installments, description, payer } = parsed;
    
    const payment = new Payment(mpClient);
    const result = await payment.create({
      body: {
        transaction_amount,
        token,
        description,
        installments,
        payment_method_id,
        issuer_id,
        payer,
        notification_url: `${req.protocol}://${req.get("host")}/api/payments/mercadopago/webhook`
      }
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Estructura de pago inválida.", details: err.errors });
    }
    console.error("[Modular Payments MP ERROR]:", err);
    res.status(500).json({ error: "Error de servidor al procesar el pago con Mercado Pago. Por favor, intente más tarde." });
  }
});

paymentsRouter.post("/mercadopago/webhook", async (req, res) => {
  try {
    if (!verifyMPSignature(req)) {
      console.warn("[mercadopago/webhook] Unauthorized signature attempt blocked.");
      return res.status(401).send("Unauthorized signature");
    }
    const { action, data } = req.body;
    if (action === "payment.created" || action === "payment.updated") {
      console.log(`[Modular Webhook] Mercado Pago status push received for ID: ${data?.id}`);
      if (mpClient && data?.id) {
        const payment = new Payment(mpClient);
        const paymentInfo = await payment.get({ id: data.id });
        if (paymentInfo.status === "approved") {
          const orderId = paymentInfo.external_reference || `MP-ORD-${data.id}`;
          const amount = Number(paymentInfo.transaction_amount);
          const payerEmail = paymentInfo.payer?.email || "pagos@stockflow.cl";
          const payerName = paymentInfo.payer?.first_name || "Cliente MP";
          
          await emitElectronicBoleta({
            orderId,
            amount,
            buyerEmail: payerEmail,
            customerName: payerName,
            gateway: "mercadopago",
            paymentId: String(data.id),
            items: [{ name: paymentInfo.description || "Compra Online MercadoPago", quantity: 1, price: amount }]
          });
        }
      }
    }
    res.sendStatus(200);
  } catch (error: any) {
    console.error("[Modular MP Webhook ERROR]:", error);
    res.sendStatus(200); // MP requires 200/201 response to stop retrying
  }
});

/* ==========================================
   ROUTE: Flow Chile Create Payment Link
   ========================================== */
paymentsRouter.post("/flow/create-payment", async (req, res) => {
  try {
    // Validate schema with Zod
    const parsed = FlowCreatePaymentSchema.parse(req.body);
    const { amount, email, description, externalId, baseUrl } = parsed;

    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      throw new Error("FLOW_API_KEY y/o FLOW_SECRET_KEY no se encuentran declarados.");
    }

    const params: Record<string, any> = {
      apiKey: FLOW_API_KEY,
      commerceOrder: externalId,
      subject: description,
      amount: amount,
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
      console.error("[Modular Payments] Flow direct response error:", data);
      res.status(400).json({ error: data.message || "Error devuelto por el servidor de Flow" });
    }
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Parámetros de pago inválidos.", details: err.errors });
    }
    console.error("[Modular Payments Flow ERROR]:", err);
    res.status(500).json({ error: "Error de servidor al crear la transacción con Flow Chile. Por favor, intente más tarde." });
  }
});

/* ==========================================
   ROUTE: Flow Chile Webhook Confirmation Handler
   ========================================== */
paymentsRouter.post("/flow/confirm", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") return res.status(400).send("No token supplied");

    // Clean token string of unwanted characters to prevent command triggers
    const cleanToken = token.trim().replace(/[^a-zA-Z0-9_-]/g, "");

    // Verify payment authenticity and parse status with Flow endpoints
    const params = {
      apiKey: FLOW_API_KEY,
      token: cleanToken
    };
    
    const s = getFlowSignature(params);
    const query = new URLSearchParams({ ...params, s }).toString();
    
    const response = await fetch(`${FLOW_URL}/payment/getStatus?${query}`);
    const statusData = await response.json();

    console.log("[Modular Payments Confirmation Webhook]:", statusData);
    
    // Status 2 is PAID / APPROVED in Flow
    if (statusData.status === 2 || statusData.status === "2") {
      const orderId = statusData.commerceOrder || `FLOW-ORD-${cleanToken.substring(0, 8)}`;
      const amount = Number(statusData.amount);
      const buyerEmail = statusData.payer || "cliente@flow.cl";
      const subject = statusData.subject || "Compra Online Flow";
      
      await emitElectronicBoleta({
        orderId,
        amount,
        buyerEmail,
        customerName: statusData.payerName || "Cliente Flow",
        gateway: "flow",
        paymentId: cleanToken,
        items: [{ name: subject, quantity: 1, price: amount }]
      });
    }

    res.send("ok");
  } catch (err) {
    console.error("[Modular Payments Confirmation ERROR]:", err);
    res.status(500).send("error");
  }
});

/* ==========================================
   ROUTE: Manual / Demo Electronic Receipt Emission Endpoint (Testing/Simulation)
   ========================================== */
paymentsRouter.post("/payments/emit-boleta-manual", requireAuthBearer as any, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate with Zod Schema
    const parsed = EmisionManualSchema.parse(req.body);
    const { orderId, amount, buyerEmail, customerName, customerTaxId, items, gateway } = parsed;

    const boleta = await emitElectronicBoleta({
      orderId,
      amount,
      buyerEmail,
      customerName: customerName || "Cliente Demo",
      customerTaxId: customerTaxId || "18.394.029-K",
      gateway: gateway || "direct_simulation",
      paymentId: `MOCK-PAY-${Date.now().toString().substring(6)}`,
      items: (items || [{ name: "Compra de Prueba StockFlow", quantity: 1, price: amount }]) as any
    });

    res.status(201).json({ success: true, message: "Boleta electrónica simulada emitida con éxito en Sandbox.", boleta });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Esquema de emisión manual inválido.", details: err.errors });
    }
    console.error("[Manual Emission Router ERROR]:", err);
    res.status(500).json({ error: "Error interno al procesar y emitir el borrador de boleta virtual." });
  }
});

/* ==========================================
   ROUTE: Flow Chile Instant Check Status
   ========================================== */
paymentsRouter.get("/flow/payment-status", async (req, res) => {
  try {
    const { token } = req.query;
    const parsed = FlowPaymentStatusSchema.parse({ token });
    
    const cleanToken = parsed.token.trim().replace(/[^a-zA-Z0-9_-]/g, "");

    const params = {
      apiKey: FLOW_API_KEY,
      token: cleanToken
    };
    
    const s = getFlowSignature(params);
    const query = new URLSearchParams({ ...params, s }).toString();
    
    const response = await fetch(`${FLOW_URL}/payment/getStatus?${query}`);
    const statusData = await response.json();

    res.json(statusData);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Token de consulta inválido o vacío.", details: err.errors });
    }
    console.error("[Flow Instant Status Error]:", err);
    res.status(500).json({ error: "Error interno del servidor al consultar el estado de la transacción en Flow." });
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
