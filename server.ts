import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

import { barcodeRouter, healthCheck as barcodeHealth } from "./server/routes/barcode";
import { paymentsRouter, healthCheck as paymentsHealth } from "./server/routes/payments";
import { commsRouter, healthCheck as commsHealth } from "./server/routes/comms";
import { aiRouter, healthCheck as aiHealth } from "./server/routes/ai";
import { startLowStockMonitor } from "./server/services/lowStockMonitor";
import { shrinkageRouter, healthCheck as shrinkageHealth } from "./server/routes/shrinkage";
import { auditRouter, expressAuditMiddleware, healthCheck as auditHealth } from "./server/routes/audit";
import { requireAuth } from "./server/middleware/requireAuth";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Express to trust upstream reverse proxy headers (vital for accurate rate limits in Cloud Run)
  app.set("trust proxy", 1);

  // CORS Configuration
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
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error("No permitido por CORS en producción"));
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };

  app.use(cors(corsOptions));

  // Security Headers configuration
  if (process.env.NODE_ENV === "production") {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://www.googletagmanager.com"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind 4 inline
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://firestore.googleapis.com",
            "https://identitytoolkit.googleapis.com",
            "https://api.flow.cl",
            "https://api.mercadopago.com"
          ],
          frameAncestors: ["'none'"]
        }
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    }));
  } else {
    // Relaxed helmet in development to not break HMR / local server WebSocket connections
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
  }

  // Rate Limiting Config
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    validate: false, // disable validation warnings for proxies/forwarded headers
    message: { error: "Demasiadas peticiones. Por favor, intenta de nuevo más tarde." }
  });

  const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests for AI routes
    standardHeaders: true,
    legacyHeaders: false,
    validate: false, // disable validation warnings for proxies/forwarded headers
    message: { error: "Límite de peticiones de IA excedido. Por favor, intenta de nuevo en un minuto." }
  });

  // Global High-Capacity Middlewares for our Hybrid API Gateway
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(expressAuditMiddleware);

  // Apply Rate Limiters
  app.use("/api/ai/insights", aiLimiter);
  app.use("/api", generalLimiter);

  // API Gateway Health-Check Probe Endpoint
  app.get("/api/health", (req, res) => {
    const barcodeStatus = barcodeHealth();
    const paymentsStatus = paymentsHealth();
    const commsStatus = commsHealth();
    const aiStatus = aiHealth();
    const shrinkageStatus = shrinkageHealth();
    const auditStatus = auditHealth();

    const allOnline = 
      barcodeStatus.status === "online" && 
      paymentsStatus.status === "online" && 
      commsStatus.status === "online" && 
      aiStatus.status === "online" &&
      shrinkageStatus.status === "online" &&
      auditStatus.status === "online";

    res.json({ 
      status: allOnline ? "online" : "degraded", 
      architecture: "hybrid-modular", 
      apiVersion: "2.0.0",
      timestamp: new Date().toISOString(),
      modules: {
        barcode: barcodeStatus,
        payments: paymentsStatus,
        comms: commsStatus,
        ai: aiStatus,
        shrinkage: shrinkageStatus,
        audit: auditStatus
      }
    });
  });

  // Delegating to Modular Endpoint Routers (Decoupled Backends)
  app.use("/api", requireAuth, barcodeRouter);
  app.use("/api", paymentsRouter); // Public webhooks endpoint; inner sensitive endpoints are protected
  app.use("/api", requireAuth, commsRouter);
  app.use("/api", aiRouter); // Inner routes handle authentication and roles check
  app.use("/api", requireAuth, shrinkageRouter);
  app.use("/api", requireAuth, auditRouter);

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
