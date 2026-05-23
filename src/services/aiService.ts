import { auth } from '../lib/firebase';

export interface StockInsight {
  analysis: string;
  recommendations: Array<{
    productName: string;
    action: "RESTOCK" | "DISCOUNT" | "MONITOR";
    reason: string;
  }>;
  summary: string;
}

// Calls the secure backend /api/ai/insights endpoint.
// Products are read server-side from Firestore — costPrice and API key NEVER exposed to client.
// Bearer token required — server validates role before calling Gemini.
export async function getStockInsights(transactions: any[], expenses: any[] = []): Promise<StockInsight> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return {
        analysis: "Usuario no autenticado.",
        recommendations: [],
        summary: "Inicia sesión para obtener análisis de IA."
      };
    }

    const token = await user.getIdToken();

    const response = await fetch("/api/ai/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ transactions, expenses })
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { analysis: "No autorizado.", recommendations: [], summary: "Token inválido o expirado." };
      }
      if (response.status === 403) {
        return { analysis: "Sin permisos.", recommendations: [], summary: "Tu rol no tiene acceso a análisis de IA." };
      }
      if (response.status === 503) {
        return { analysis: "API Key no configurada.", recommendations: [], summary: "Configura GEMINI_API_KEY en el servidor." };
      }
      const errData = await response.json().catch(() => ({}));
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
      summary: "Verifica la conexión al servidor."
    };
  }
}
