import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

import { barcodeRouter } from "./server/routes/barcode";
import { paymentsRouter } from "./server/routes/payments";
import { commsRouter } from "./server/routes/comms";
import { aiRouter } from "./server/routes/ai";
import { startLowStockMonitor } from "./server/services/lowStockMonitor";

// Load .env.local first (local dev secrets), then .env fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS — open in dev, restricted to project domains in production
  const allowedOrigins = [
    "https://ais-pre-nviwywn3zhtjosxtuaeuaa-34034757239.us-east1.run.app",
    "https://ais-dev-nviwywn3zhtjosxtuaeuaa-34034757239.us-east1.run.app"
  ];

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (process.env.NODE_ENV !== "production" || !origin) {
        callback(null, true);
      } else {
        const isAllowed = allowedOrigins.includes(origin) ||
                          origin.endsWith(".run.app") ||
                          origin.includes("34034757239.us-east1.run.app");
        callback(isAllowed ? null : new Error("No permitido por CORS en producción"), isAllowed);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };

  app.use(cors(corsOptions));

  // Rate Limiting — strict limit for AI (costs money), general for all /api
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones. Por favor, intenta de nuevo más tarde." }
  });

  const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Gemini calls are expensive — strict cap
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Límite de peticiones de IA excedido. Por favor, intenta de nuevo en un minuto." }
  });

  // Global High-Capacity Middlewares for our Hybrid API Gateway
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Apply Rate Limiters (AI first — more specific route takes precedence)
  app.use("/api/ai/insights", aiLimiter);
  app.use("/api", generalLimiter);

  // API Gateway Health-Check Probe Endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      architecture: "hybrid-modular",
      apiVersion: "2.0.0",
      timestamp: new Date().toISOString()
    });
  });

  // Delegating to Modular Endpoint Routers (Decoupled Backends)
  app.use("/api", barcodeRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", commsRouter);
  app.use("/api", aiRouter);

  // Vite development compiler integration or static production delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Hybrid Server Core] API Gateway executing cleanly on http://localhost:${PORT}`);
    startLowStockMonitor();
  });
}

startServer();
