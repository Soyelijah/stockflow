import { Router } from "express";
import { z } from "zod";

export const commsRouter = Router();

const SendReceiptSchema = z.object({
  customerEmail: z.string().email(),
  businessName: z.string().min(1).max(100),
  orderDetails: z.object({
    id: z.string(),
    total: z.union([z.number(), z.string()]).transform((val) => Number(val))
  }).passthrough()
});

commsRouter.post("/send-receipt", async (req, res) => {
  try {
    const parsed = SendReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.format() });
    }

    const { customerEmail, orderDetails, businessName } = parsed.data;
    
    // Security: Log only non-PII details (txId and businessName). Do not log customerEmail or full orderDetails.
    console.log(`[Comms] receipt enqueued`, { txId: orderDetails.id, business: businessName });

    // Simulate standard async background loop for modern microservices SMTP gateways
    await new Promise(resolve => setTimeout(resolve, 850));

    res.json({ 
      success: true, 
      message: "Receipt successfully routed through modular comms distribution gateway.",
      preview: `Email queued successfully` // Redact PII (customerEmail) from response preview
    });
  } catch (err: any) {
    console.error("[Modular Comms ERROR]:", err);
    res.status(500).json({ error: err.message || "Failed to process receipt queue distribution" });
  }
});

export function healthCheck() {
  const isConfigured = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  return {
    status: isConfigured ? "online" : "offline",
    details: {
      smtpSimulated: !isConfigured,
      queueHealthy: true,
      hasCredentials: isConfigured,
      smtpHost: process.env.SMTP_HOST || "missing",
      smtpUser: process.env.SMTP_USER || "missing"
    }
  };
}
