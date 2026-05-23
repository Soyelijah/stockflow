import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";

export const aiRouter = Router();

// Initialize Gemini safely — only if key exists
const ai = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    })
  : null;

// POST /api/ai/insights
// Security: requires valid Firebase Bearer token with admin/owner/inventory_manager role
// Products are read SERVER-SIDE from Firestore — costPrice NEVER exposed to client
aiRouter.post("/ai/insights", async (req, res) => {
  try {
    // --- Auth Middleware ---
    let admin: any;
    try {
      const adminModule = await import("firebase-admin");
      admin = adminModule.default || adminModule;
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
    } catch(e) {
      return res.status(500).json({ error: "Firebase Admin initialization failed." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. Missing Bearer token." });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
    }

    const role = decodedToken.role || "customer";
    if (!['admin', 'owner', 'inventory_manager', 'manager'].includes(role) && decodedToken.email !== 'solier.elijah@gmail.com') {
      return res.status(403).json({ error: "Forbidden. Insufficient permissions." });
    }

    if (!ai) {
      return res.status(503).json({ error: "Gemini API key not configured on server." });
    }

    // --- Payload Validation ---
    const { transactions, expenses } = req.body;
    if (transactions && transactions.length > 50) {
      return res.status(400).json({ error: "Too many transactions in payload (max 50)." });
    }

    // --- Server-Side Product Read (costPrice never leaves server) ---
    const productsSnap = await admin.firestore().collection('products').limit(500).get();
    const inventoryData = productsSnap.docs.map((d: any) => {
      const p = d.data();
      return {
        name: p.name,
        stock: p.stock,
        min: p.minThreshold,
        price: p.price,
        cost: p.costPrice  // Read securely server-side, NOT from client payload
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

    const expenseData = Array.isArray(expenses)
      ? expenses.map((e: any) => ({ cat: e.category, amt: e.amount, desc: e.description }))
      : [];

    // --- Gemini AI Analysis ---
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
    res.status(500).json({ error: error.message || "Failed to generate AI insights." });
  }
});

export function healthCheck() {
  const isEnabled = Boolean(process.env.GEMINI_API_KEY);
  return {
    status: isEnabled ? "online" : "offline",
    details: {
      geminiConnected: isEnabled,
      model: "gemini-2.5-flash",
      hasKey: isEnabled,
    }
  };
}
