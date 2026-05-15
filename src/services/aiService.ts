import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface StockInsight {
  analysis: string;
  recommendations: Array<{
    productName: string;
    action: "RESTOCK" | "DISCOUNT" | "MONITOR";
    reason: string;
  }>;
  summary: string;
}

export async function getStockInsights(products: any[], transactions: any[], expenses: any[] = []): Promise<StockInsight> {
  const model = "gemini-3-flash-preview";
  
  // Format data for AI to minimize tokens but keep context
  const inventoryData = products.map(p => ({
    name: p.name,
    stock: p.stock,
    min: p.minThreshold,
    price: p.price,
    cost: p.costPrice
  }));

  const salesData = transactions
    .filter(t => t.type === "sale")
    .slice(0, 50) // Last 50 sales for trend
    .map(t => ({
      name: t.productName,
      qty: t.quantity,
      time: t.timestamp?.toDate ? t.timestamp.toDate().toISOString() : new Date().toISOString()
    }));

  const expenseData = expenses.map(e => ({
    cat: e.category,
    amt: e.amount,
    desc: e.description
  }));

  const prompt = `Analiza el estado del negocio retail. 
    Datos de inventario: ${JSON.stringify(inventoryData)}
    Datos de ventas recientes: ${JSON.stringify(salesData)}
    Gastos operacionales: ${JSON.stringify(expenseData)}
    
    Proporciona un análisis estratégico sobre rentabilidad neta (Ventas - Costos de productos - Gastos), recomendaciones específicas y un resumen ejecutivo.`;

  try {
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

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw error;
  }
}
