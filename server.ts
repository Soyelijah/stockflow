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
import { startFCMStatusListener } from "./server/services/fcmListener";
import { shrinkageRouter, healthCheck as shrinkageHealth } from "./server/routes/shrinkage";
import { auditRouter, expressAuditMiddleware, healthCheck as auditHealth } from "./server/routes/audit";
import { customerRouter, healthCheck as customerHealth } from "./server/routes/customer";
import { staffRouter, healthCheck as staffHealth } from "./server/routes/staff";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Disable X-Powered-By header to prevent fingerprinting
  app.disable("x-powered-by");

  // Use Helmet for advanced server-side header protection and Anti-Clickjacking
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

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
        // Localhost/127.0.0.1 always allowed even in production mode — useful for
        // production-like smoke tests (e.g. Playwright probes that arrancan el
        // server con NODE_ENV=production + STATIC_DIR=dist-staff). External
        // .run.app domains keep the existing whitelist.
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const isAllowed = isLocalhost ||
                          allowedOrigins.includes(origin) ||
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
    const customerStatus = customerHealth();
    const staffStatus = staffHealth();

    const allOnline =
      barcodeStatus.status === "online" &&
      paymentsStatus.status === "online" &&
      commsStatus.status === "online" &&
      aiStatus.status === "online" &&
      shrinkageStatus.status === "online" &&
      auditStatus.status === "online" &&
      customerStatus.status === "online" &&
      staffStatus.status === "online";

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
        audit: auditStatus,
        customer: customerStatus,
        staff: staffStatus
      }
    });
  });

  // Delegating to Modular Endpoint Routers (Decoupled Backends)
  app.use("/api", barcodeRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", commsRouter);
  app.use("/api", aiRouter);
  app.use("/api", shrinkageRouter);
  app.use("/api", auditRouter);
  app.use("/api", customerRouter);
  app.use("/api", staffRouter);

  // Vite development compiler integration or static production delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Tier 5.B: support per-variant static dirs via STATIC_DIR env var.
    // Default kept as "dist" for backward compat with the legacy monolithic
    // bundle. Set STATIC_DIR=dist-staff (or dist-client / dist-driver) to
    // serve the variant bundle in a production-like setup. Useful for the
    // create-employee modal smoke test which exercises both UI + /api/* in
    // one origin.
    const distPath = path.join(process.cwd(), process.env.STATIC_DIR || "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Hybrid Server Core] API Gateway executing cleanly on http://localhost:${PORT}`);
    startLowStockMonitor();
    startFCMStatusListener();
  });
}

startServer();
