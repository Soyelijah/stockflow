export interface StockInsight {
  analysis: string;
  recommendations: Array<{
    productName: string;
    action: "RESTOCK" | "DISCOUNT" | "MONITOR";
    reason: string;
  }>;
  summary: string;
}

import { auth } from '../lib/firebase';

export async function getStockInsights(transactions: any[], expenses: any[] = []): Promise<StockInsight> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transactions, expenses })
    });

    if (!response.ok) {
      if (response.status === 503) {
        return {
          analysis: "API Key no configurada.",
          recommendations: [],
          summary: "Configura tu API Key de Gemini en el archivo .env.local del servidor para obtener análisis."
        };
      }
      const errData = await response.json().catch(() => ({}));
      console.warn("AI insights failed:", errData);
      return {
        analysis: "No se pudieron obtener insights en este momento.",
        recommendations: [],
        summary: errData.error || "Error de comunicación con el servidor."
      };
    }

    return await response.json();
  } catch (error) {
    console.error("AI Insight Fetch Error:", error);
    return {
      analysis: "Error de red al consultar la IA.",
      recommendations: [],
      summary: "Error de red."
    };
  }
}
