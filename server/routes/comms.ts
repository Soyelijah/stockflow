import { Router } from "express";

export const commsRouter = Router();

commsRouter.post("/send-receipt", async (req, res) => {
  try {
    const { customerEmail, orderDetails, businessName } = req.body;
    
    console.log(`[Modular Comms Engine] Enqueuing digital receipt email to: ${customerEmail} to ${businessName}`);
    console.log(`[Modular Comms Engine] Transaction payload serialized:`, JSON.stringify(orderDetails, null, 2));

    // Simulate standard async background loop for modern microservices SMTP gateways
    await new Promise(resolve => setTimeout(resolve, 850));

    res.json({ 
      success: true, 
      message: "Receipt successfully routed through modular comms distribution gateway.",
      preview: `Email queued to ${customerEmail}`
    });
  } catch (err: any) {
    console.error("[Modular Comms ERROR]:", err);
    res.status(500).json({ error: err.message || "Failed to process receipt queue distribution" });
  }
});

export function healthCheck() {
  return {
    status: "online",
    details: {
      smtpSimulated: true,
      queueHealthy: true
    }
  };
}
