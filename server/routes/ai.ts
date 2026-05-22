import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";

export const aiRouter = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

aiRouter.post("/ai/insights", async (req, res) => {
  try {
    const { products, transactions, expenses } = req.body;

    if (!Array.isArray(products) || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "Missing required products or transactions array." });
    }

    const inventoryData = products.map((p: any) => ({
      name: p.name,
      stock: p.stock,
      min: p.minThreshold,
      price: p.price,
      cost: p.costPrice
    }));

    const salesData = transactions
      .filter((t: any) => t.type === "sale")
      .slice(0, 50)
      .map((t: any) => ({
        name: t.productName,
        qty: t.quantity,
        time: t.timestamp?.toDate ? t.timestamp.toDate().toISOString() : new Date().toISOString()
      }));

    const expenseData = Array.isArray(expenses)
      ? expenses.map((e: any) => ({
          cat: e.category,
          amt: e.amount,
          desc: e.description
        }))
      : [];

    const prompt = `Analiza el estado del negocio retail. 
    Datos de inventario: ${JSON.stringify(inventoryData)}
    Datos de ventas recientes: ${JSON.stringify(salesData)}
    Gastos operacionales: ${JSON.stringify(expenseData)}
    
    Proporciona un análisis estratégico sobre rentabilidad neta (Ventas - Costos de productos - Gastos), recomendaciones específicas y un resumen ejecutivo.`;

    const model = "gemini-3.5-flash";

    const result = await ai.models.generateContent({
      model,
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

    const textOutput = result.text;
    res.json(JSON.parse(textOutput || "{}"));
  } catch (error: any) {
    console.error("AI Insight Endpoint Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI insights" });
  }
});

export function healthCheck() {
  const isEnabled = Boolean(process.env.GEMINI_API_KEY);
  return {
    status: isEnabled ? "online" : "offline",
    details: {
      geminiConnected: isEnabled,
      model: "gemini-3.5-flash",
      hasKey: isEnabled,
    }
  };
}
