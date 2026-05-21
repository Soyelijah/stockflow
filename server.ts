import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import dotenv from "dotenv";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config({ path: '.env.local' });

// Gemini Config
const ai = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    })
  : null;

// Mercado Pago Config
const mpClient = process.env.MERCADOPAGO_ACCESS_TOKEN 
  ? new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 5000 } })
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // FLOW CONFIGURATION
  const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
  const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
  const FLOW_ENVIRONMENT = (process.env.FLOW_ENVIRONMENT || "sandbox").toLowerCase();
  
  const FLOW_URL = FLOW_ENVIRONMENT === "production" 
    ? "https://www.flow.cl/api" 
    : "https://sandbox.flow.cl/api";

  console.log(`[Flow] Iniciando en modo: ${FLOW_ENVIRONMENT}`);

  function getFlowSignature(params: Record<string, any>) {
    const keys = Object.keys(params).sort();
    const query = keys.map(key => `${key}=${params[key]}`).join("&");
    return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(query).digest("hex");
  }

  // API ROUTES
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", flowEnv: FLOW_ENVIRONMENT, hasGemini: !!ai });
  });

  // PRELOADED LOCAL DATABASE AND FALLBACKS (Saves API Quota & Prevents Crashing)
  const LOCAL_BARCODE_DB: Record<string, { name: string; category: string; brand: string; imageUrl: string; description: string }> = {
    "7801505000419": {
      name: "Endulzante Daily Stevia Líquido 180ml",
      category: "Abarrotes",
      brand: "Daily",
      imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500",
      description: "Endulzante líquido natural chileno tipo Stevia en formato gotas de 180ml."
    },
    "7801505000402": {
      name: "Endulzante Daily Sucralosa 180ml",
      category: "Abarrotes",
      brand: "Daily",
      imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500",
      description: "Endulzante de mesa líquido chileno con sucralosa de alta calidad de 180ml."
    },
    "7801320000557": {
      name: "Endulzante Iansa Cero K Estevia Líquida 180ml",
      category: "Abarrotes",
      brand: "Iansa Cero K",
      imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500",
      description: "Endulzante en botella líquido chileno Iansa Cero K estevia, de alta solubilidad."
    },
    "7801320000564": {
      name: "Endulzante Iansa Cero K Sucralosa Botella 180ml",
      category: "Abarrotes",
      brand: "Iansa Cero K",
      imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500",
      description: "Endulzante en botella líquido chileno Iansa Cero K sucralosa, ideal para té, café y repostería."
    },
    "7802110041284": {
      name: "Néctar Watt's Piña Guayaba 1.5L",
      category: "Bebidas",
      brand: "Watt's",
      imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500",
      description: "Néctar premium Watt's sabor piña guayaba en formato familiar de 1.5 Litros."
    },
    "7802110000021": {
      name: "Néctar Watt's Durazno 1L",
      category: "Bebidas",
      brand: "Watt's",
      imageUrl: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=500",
      description: "Néctar clásico chileno de durazno Watt's, elaborado con pulpa de fruta seleccionada de 1 Litro."
    },
    "7803000620201": {
      name: "Néctar Watt's Piña 1.5L",
      category: "Bebidas",
      brand: "Watt's",
      imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500",
      description: "Jugo néctar Watt's sabor piña natural en formato de 1.5 Litros."
    },
    "7802110000106": {
      name: "Néctar Watt's Damasco 1.5L",
      category: "Bebidas",
      brand: "Watt's",
      imageUrl: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=500",
      description: "Néctar chileno sabor damasco Watt's en botella conveniente de 1.5 Litros."
    },
    "7802100000015": {
      name: "Leche Entera Soprole 1L",
      category: "Lácteos",
      brand: "Soprole",
      imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500",
      description: "Leche líquida entera SOPROLE, reconstituida con vitaminas A, C y D, formato 1 Litro."
    },
    "7801610001097": {
      name: "Aceite de Maravilla Natura 1L",
      category: "Abarrotes",
      brand: "Natura",
      imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500",
      description: "Aceite 100% puro de maravilla Natura, ideal para cocinar todo tipo de platos chilenos."
    },
    "7802420004153": {
      name: "Arroz Grado 1 Tucapel 1kg",
      category: "Abarrotes",
      brand: "Tucapel",
      imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500",
      description: "Arroz grano largo ancho Grado 1 Tucapel seleccionado."
    },
    "7801810539121": {
      name: "Bebida Coca-Cola Sabor Original 1.5L",
      category: "Bebidas",
      brand: "Coca-Cola",
      imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500",
      description: "Refresco Coca-Cola Sabor Original botella de 1.5 Litros."
    },
    "7802950001198": {
      name: "Papel Higiénico Confort Doble Hoja 4 unidades",
      category: "Aseo",
      brand: "Confort",
      imageUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500",
      description: "Papel higiénico chileno suave y resistente de doble hoja en paquete de 4 rollos."
    },
    "7801000045009": {
      name: "Pisco Especial Alto del Carmen 35° 750ml",
      category: "Licores",
      brand: "Alto del Carmen",
      imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500",
      description: "Pisco chileno de selección premium especial de 35 grados originario del Valle del Huasco."
    },
    "7801030001921": {
      name: "Té Club Negro Premium 100 bolsitas",
      category: "Abarrotes",
      brand: "Té Club",
      imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500",
      description: "Té negro premium de selección, formato pack familiar con 100 bolsitas."
    },
    "7801504910054": {
      name: "Stevia Daily Líquido Frasco 180ml",
      category: "Abarrotes",
      brand: "Daily",
      imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500",
      description: "Endulzante de mesa líquido chileno de extracto natural Stevia formato gotas de 180ml."
    }
  };

  // Barcode Lookup with Gemini Auto Fallback
  app.get("/api/barcode-lookup", async (req, res) => {
    try {
      const { barcode } = req.query;
      if (!barcode || typeof barcode !== "string") {
        return res.status(400).json({ error: "No barcode provided" });
      }

      const cleanBarcode = barcode.trim();

      // 1. FAST LOCAL CHECK (To avoid calling API and safe-guard key limits)
      if (LOCAL_BARCODE_DB[cleanBarcode]) {
        console.log(`[Local DB Hit] Identified trademarked item: ${cleanBarcode}`);
        return res.json({ ...LOCAL_BARCODE_DB[cleanBarcode], source: "local_cache" });
      }

      // 2. AI CALL (If key exists, try calling Gemini)
      if (ai) {
        try {
          const prompt = `Identifica el producto real chileno o internacional con código de barras (EAN/UPC): ${cleanBarcode}. 
          REQUISITO CRÍTICO: Realiza una búsqueda web exhaustiva sobre qué producto corresponde a este código de barra exacto en el mercado nacional de CHILE (supermercados como Lider, Jumbo, Santa Isabel, Unimarc, etc.).

          Retorna un objeto JSON con: 
          - name: El nombre comercial real y COMPLETO del producto (incluyendo marca, sabor/tipo y volumen/peso ej: "Néctar Watt's Damasco 1.5L").
          - category: La categoría general (ej: "Abarrotes", "Bebidas", "Aseo", "Lácteos", "Farmacia").
          - brand: La marca fabricante real del producto.
          - imageUrl: Una URL de imagen del producto real (preferiblemente que termine en jpeg/jpg o png). Si encuentras URLs de imágenes directas en Lider o openfoodfacts, úsalas. Si no estás seguro, retorna una cadena vacía "". No uses imágenes genéricas.
          - description: Una descripción breve y técnica en español con datos del producto.
          
          Formato de respuesta: ÚNICAMENTE JSON puro.`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  imageUrl: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["name"]
              }
            }
          });

          const data = JSON.parse(response.text || "{}");
          console.log(`[Gemini Barcode Success] Found real item for ${cleanBarcode}:`, data.name);
          return res.json({ ...data, source: "gemini_api" });
        } catch (apiErr: any) {
          // Fall back gracefully on rate levels, quota limits, or API shortages silently
          console.warn(`[Gemini Safe Fallback] Offline local fallback activated for barcode: ${cleanBarcode}`, apiErr?.message || apiErr);
        }
      } else {
        console.info("[Gemini Not Configured] Initiating offline fallback generator.");
      }

      // 3. SECURE DETAILED SMART FALLBACK (Guarantees zero-error high quality UI experience)
      const isChilean = cleanBarcode.startsWith("780");
      
      const fallbackProduct = {
        name: "", // Leave blank so user can enter manually
        category: "",
        brand: "",
        imageUrl: "",
        description: "",
        isFallback: true,
        source: "smart_generator"
      };

      return res.json(fallbackProduct);

    } catch (err: any) {
      console.warn("[Barcode Route Handler] Safe catchall activated.");
      // Absolute guarantee of non-crash fallback response
      res.json({
        name: "",
        category: "",
        brand: "",
        imageUrl: "",
        description: "",
        isFallback: true,
        source: "guarantor_catchall"
      });
    }
  });

  // Mercado Pago Payment Processing (Wallets/Google Pay/Apple Pay)
  app.post("/api/mercadopago/process-payment", async (req, res) => {
    try {
      if (!mpClient) {
        throw new Error("Mercado Pago no está configurado en el servidor.");
      }

      const { token, issuer_id, payment_method_id, transaction_amount, installments, description, payer } = req.body;
      
      const payment = new Payment(mpClient);
      const result = await payment.create({
        body: {
          transaction_amount: Number(transaction_amount),
          token,
          description,
          installments: Number(installments),
          payment_method_id,
          issuer_id,
          payer,
          notification_url: `${req.protocol}://${req.get('host')}/api/mercadopago/webhook`
        }
      });

      res.status(201).json(result);
    } catch (err: any) {
      console.error("Mercado Pago Error:", err);
      res.status(500).json({ error: err.message || "Error al procesar el pago" });
    }
  });

  app.post("/api/mercadopago/webhook", async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.created" || action === "payment.updated") {
      console.log("Mercado Pago Notification:", data.id);
    }
    res.sendStatus(200);
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
        commerceOrder: externalId,
        subject: description,
        amount: cleanAmount,
        currency: "CLP",
        email: email,
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

  // Mock Receipt Email Route
  app.post("/api/send-receipt", async (req, res) => {
    try {
      const { customerEmail, orderDetails, businessName } = req.body;
      
      console.log(`[RECEIPT] Sending email to ${customerEmail} for order from ${businessName}`);
      console.log(`[RECEIPT] Details:`, JSON.stringify({ id: orderDetails?.id || 'unknown', total: orderDetails?.total || 0 }));

      // Simulate a small delay for email processing
      await new Promise(resolve => setTimeout(resolve, 800));

      res.json({ 
        success: true, 
        message: "Receipt email sent to the customer queue.",
        preview: `Email sent to ${customerEmail}`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Initialize Firebase Admin if needed
  let admin: any;
  try {
    admin = await import("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  } catch(e) {
    console.warn("Firebase Admin Initialization fallback.");
  }

  // AI Insights Endpoint
  app.post("/api/ai/insights", async (req, res) => {
    try {
      // Security: Validate Bearer token via Firebase Admin
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized. Missing Bearer token." });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken: any;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Unauthorized. Invalid token." });
      }

      const role = decodedToken.role || "customer";
      // TODO(day2): remove email-based role inference — replace with custom claim
      if (!['admin', 'owner', 'inventory_manager'].includes(role) && decodedToken.email !== 'solier.elijah@gmail.com') {
        return res.status(403).json({ error: "Forbidden. Insufficient permissions." });
      }

      if (!ai) {
        return res.status(503).json({ error: "Gemini API no configurada en el servidor." });
      }

      // Security: Validate payload size
      const { transactions, expenses } = req.body;
      if (transactions && transactions.length > 50) {
        return res.status(400).json({ error: "Demasiadas transacciones en el payload." });
      }

      // Security: Read products directly from Firestore to avoid costPrice leak
      const productsSnap = await admin.firestore().collection('products').limit(500).get();
      const inventoryData = productsSnap.docs.map((d: any) => {
        const p = d.data();
        return {
          name: p.name,
          stock: p.stock,
          min: p.minThreshold,
          price: p.price
          // costPrice safely omitted here since it's an AI read payload
        };
      });

      const salesData = (transactions || [])
        .filter((t: any) => t.type === "sale")
        .slice(0, 50)
        .map((t: any) => ({
          name: t.productName,
          qty: t.quantity,
          time: t.timestamp?.toDate ? t.timestamp.toDate().toISOString() : new Date().toISOString()
        }));

      const expenseData = (expenses || []).map((e: any) => ({
        cat: e.category,
        amt: e.amount,
        desc: e.description
      }));

      const prompt = `Analiza el estado del negocio retail. 
        Datos de inventario: ${JSON.stringify(inventoryData)}
        Datos de ventas recientes: ${JSON.stringify(salesData)}
        Gastos operacionales: ${JSON.stringify(expenseData)}
        
        Proporciona un análisis estratégico sobre rentabilidad neta (Ventas - Costos de productos - Gastos), recomendaciones específicas y un resumen ejecutivo.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Eres un experto analista de inventarios y negocios retail. Tu objetivo es ayudar al dueño a optimizar su stock, evitar quiebres y maximizar ganancias. Responde SIEMPRE en formato JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING, description: "Análisis general del estado de las ventas y stock." },
              summary: { type: Type.STRING, description: "Resumen ejecutivo de 2 oraciones." },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING },
                    action: { type: Type.STRING, enum: ["RESTOCK", "DISCOUNT", "MONITOR"] },
                    reason: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      res.json(JSON.parse(result.text || "{}"));
    } catch (error: any) {
      console.error("AI Insight Server Error:", error);
      res.status(500).json({ error: error.message || "Error al generar insights" });
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
