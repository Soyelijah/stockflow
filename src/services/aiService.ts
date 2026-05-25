import { auth } from "../lib/firebase";

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
  try {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/ai/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token || "sys-operator"}`
      },
      body: JSON.stringify({ products, transactions, expenses })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch AI insights from server");
    }

    return await response.json();
  } catch (error) {
    console.error("AI Insight Fetch Error:", error);
    throw error;
  }
}
