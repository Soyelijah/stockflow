import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";

export interface PredictionResult {
  productId: string;
  avgDailySales: number;
  daysRemaining: number;
  status: 'critical' | 'warning' | 'stable';
  recommendedOrder: number;
}

export async function predictStockRunout(productId: string, currentStock: number): Promise<PredictionResult> {
  // Fetch last 30 days of sales for this product
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const q = query(
    collection(db, "transactions"),
    where("productId", "==", productId),
    where("type", "==", "sale"),
    where("timestamp", ">=", thirtyDaysAgo),
    orderBy("timestamp", "desc")
  );

  const snapshot = await getDocs(q);
  let totalSold = 0;
  
  snapshot.docs.forEach(doc => {
    totalSold += doc.data().quantity || 0;
  });

  const avgDailySales = totalSold / 30;
  
  if (avgDailySales === 0) {
    return {
      productId,
      avgDailySales: 0,
      daysRemaining: Infinity,
      status: 'stable',
      recommendedOrder: 0
    };
  }

  const daysRemaining = currentStock / avgDailySales;
  let status: 'critical' | 'warning' | 'stable' = 'stable';
  
  if (daysRemaining < 3) status = 'critical';
  else if (daysRemaining < 7) status = 'warning';

  // Recommendation: Enough for 15 days + safety buffer
  const recommendedOrder = Math.ceil(avgDailySales * 15 * 1.2);

  return {
    productId,
    avgDailySales,
    daysRemaining,
    status,
    recommendedOrder
  };
}
