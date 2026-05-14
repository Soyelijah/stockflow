import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // FLOW CONFIGURATION
  const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
  const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
  const FLOW_ENVIRONMENT = (process.env.FLOW_ENVIRONMENT || "sandbox").toLowerCase();
  
  const FLOW_URL = FLOW_ENVIRONMENT === "production" 
    ? "https://www.flow.cl/api" 
    : "https://sandbox.flow.cl/api";

  console.log(`[Flow] Iniciando en modo: ${FLOW_ENVIRONMENT}`);

  function getFlowSignature(params: Record<string, any>) {
    // 1. Sort keys alphabetically
    const keys = Object.keys(params).sort();
    
    // 2. Concatenate key=value with &
    const query = keys
      .map(key => `${key}=${params[key]}`)
      .join("&");
    
    // 3. HMAC-SHA256
    return crypto
      .createHmac("sha256", FLOW_SECRET_KEY)
      .update(query)
      .digest("hex");
  }

  // API ROUTES
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", flowEnv: FLOW_ENVIRONMENT });
  });

  // Create Flow Payment
  app.post("/api/flow/create-payment", async (req, res) => {
    try {
      const { amount, email, description, externalId, baseUrl } = req.body;

      if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
        throw new Error("FLOW_API_KEY o FLOW_SECRET_KEY no configurados en Settings.");
      }

      // CLP must be integer
      const cleanAmount = Math.round(Number(amount));

      const params: Record<string, any> = {
        apiKey: FLOW_API_KEY,
        amount: cleanAmount,
        currency: "CLP",
        description: description,
        email: email,
        externalId: externalId,
        urlConfirmation: `${baseUrl}/api/flow/confirm`,
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
        console.error("Error Flow:", data);
        res.status(400).json({ error: data.message || "Error al crear pago en Flow" });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Flow Webhook Confirmation
  app.post("/api/flow/confirm", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).send("No token");

      // Verify payment status
      const params = {
        apiKey: FLOW_API_KEY,
        token: token
      };
      
      const s = getFlowSignature(params);
      const query = new URLSearchParams({ ...params, s }).toString();
      
      const response = await fetch(`${FLOW_URL}/payment/getStatus?${query}`);
      const statusData = await response.json();

      // Here you would typically update Firebase
      console.log("Flow Confirmation Status:", statusData);
      
      // Flow expects ok
      res.send("ok");
    } catch (err) {
      console.error(err);
      res.status(500).send("error");
    }
  });

  // Client-side status check
  app.get("/api/flow/payment-status", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: "No token" });

      const params = {
        apiKey: FLOW_API_KEY,
        token: token as string
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
