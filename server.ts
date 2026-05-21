import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { barcodeRouter } from "./server/routes/barcode";
import { paymentsRouter } from "./server/routes/payments";
import { commsRouter } from "./server/routes/comms";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global High-Capacity Middlewares for our Hybrid API Gateway
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
  });
}

startServer();
