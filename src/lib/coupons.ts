import { collection, getDocs, getDoc, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export interface Coupon {
  id: string; // usually same as code uppercase
  code: string;
  title: string;
  desc: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minTier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  active: boolean;
  color: string;
  img: string;
}

export interface AutomaticCoupon {
  id: string;
  code: string;
  title: string;
  desc: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  requiredPoints: number;
  color: string;
  img: string;
}

export const AUTOMATIC_POINT_COUPONS: AutomaticCoupon[] = [
  {
    id: "AUTO-BRONZE",
    code: "LOYAL-BRONZE",
    title: "Cupón Fidelididad Bronce",
    desc: "10% de descuento total",
    discountType: "percent",
    discountValue: 10,
    requiredPoints: 200,
    color: "bg-orange-50 border-orange-100 text-orange-700",
    img: "🥉"
  },
  {
    id: "AUTO-SILVER",
    code: "LOYAL-SILVER",
    title: "Cupón Fidelidad Plata",
    desc: "15% de descuento total",
    discountType: "percent",
    discountValue: 15,
    requiredPoints: 800,
    color: "bg-slate-100 border-slate-200 text-slate-700",
    img: "🥈"
  },
  {
    id: "AUTO-GOLD",
    code: "LOYAL-GOLD",
    title: "Cupón Fidelidad Oro",
    desc: "$5.000 de descuento de regalo",
    discountType: "fixed",
    discountValue: 5000,
    requiredPoints: 2000,
    color: "bg-amber-50 border-amber-100 text-amber-700",
    img: "🥇"
  },
  {
    id: "AUTO-PLATINUM",
    code: "LOYAL-PLATINUM",
    title: "Cupón Fidelidad Platino",
    desc: "$15.000 de descuento de regalo",
    discountType: "fixed",
    discountValue: 15000,
    requiredPoints: 4000,
    color: "bg-indigo-50 border-indigo-100 text-indigo-700",
    img: "💎"
  }
];

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: "SUMMER15",
    code: "SUMMER15",
    title: "Frutas de Verano",
    desc: "15% de Descuento",
    discountType: "percent",
    discountValue: 15,
    minTier: "BRONZE",
    active: true,
    color: "bg-rose-50 border-rose-100 text-rose-600",
    img: "🍎"
  },
  {
    id: "CLEANX2",
    code: "CLEANX2",
    title: "Pack Limpieza",
    desc: "10% de Descuento total",
    discountType: "percent",
    discountValue: 10,
    minTier: "SILVER",
    active: true,
    color: "bg-blue-50 border-blue-100 text-blue-600",
    img: "🧼"
  },
  {
    id: "BREADGIFT",
    code: "BREADGIFT",
    title: "Panadería Gourmet",
    desc: "$5.000 Gastronomía",
    discountType: "fixed",
    discountValue: 5000,
    minTier: "GOLD",
    active: true,
    color: "bg-amber-50 border-amber-100 text-amber-600",
    img: "🥐"
  },
  {
    id: "WINE30",
    code: "WINE30",
    title: "Vinos y Licores VIP",
    desc: "30% de Descuento total",
    discountType: "percent",
    discountValue: 30,
    minTier: "PLATINUM",
    active: true,
    color: "bg-purple-50 border-purple-100 text-purple-600",
    img: "🍷"
  }
];

export async function seedCouponsIfEmpty() {
  try {
    const configRef = doc(db, "system_config", "seeding");
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data()?.couponsSeeded) {
      // Already seeded once in history. Respect administrator's deletions/modifications!
      return;
    }

    const couponsCol = collection(db, "coupons");
    const snapshot = await getDocs(couponsCol);
    if (snapshot.empty) {
      const batch = writeBatch(db);
      DEFAULT_COUPONS.forEach((coupon) => {
        const docRef = doc(db, "coupons", coupon.id);
        batch.set(docRef, coupon);
      });
      batch.set(configRef, { couponsSeeded: true });
      await batch.commit();
      console.log("Successfully seeded coupons collection in firestore with 4 default live coupons.");
    } else {
      // If coupons already exist, mark as seeded so we don't overwrite empty later
      await setDoc(configRef, { couponsSeeded: true });
    }
  } catch (err) {
    console.error("Failed to seed coupons collection:", err);
  }
}

export async function seedCustomersIfEmpty() {
  try {
    const configRef = doc(db, "system_config", "customerSeeding");
    try {
      const configSnap = await getDoc(configRef);
      if (configSnap.exists() && configSnap.data()?.customersSeeded) {
        return;
      }
    } catch (err) {
      console.warn("Could not check customerSeeding status from system_config (expected for non-admin):", err);
    }

    const customersCol = collection(db, "customers");
    const snapshot = await getDocs(customersCol);
    
    const existingTaxIds = snapshot.empty ? [] : snapshot.docs.map(doc => {
      const tid = doc.data().taxId;
      return tid ? tid.toString().replace(/[^0-9kK]/g, "").toUpperCase() : "";
    });
    
    const defaultCustomers = [
      {
        id: "cust-elijah-solier",
        name: "Elijah Solier",
        taxId: "25.551.228-5",
        email: "solier.elijah@gmail.com",
        phone: "+56 9 1234 5678",
        points: 2450,
        balance: 45000,
        password: "123",
        segment: "vip",
        type: "wholesale"
      },
      {
        id: "cust-prueba",
        name: "Cliente de Prueba",
        taxId: "12.345.678-9",
        email: "cliente.prueba@gmail.com",
        phone: "+56 9 8765 4321",
        points: 350,
        balance: 15000,
        password: "123",
        segment: "retail",
        type: "retail"
      }
    ];

    let seededAny = false;

    for (const cust of defaultCustomers) {
      const cleanRUT = cust.taxId.replace(/[^0-9kK]/g, "").toUpperCase();
      if (!existingTaxIds.includes(cleanRUT)) {
        try {
          const docRef = doc(db, "customers", cust.id);
          await setDoc(docRef, {
            ...cust,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          seededAny = true;
          console.log(`Seeded default customer: ${cust.name}`);
        } catch (setErr) {
          console.error(`Failed to set customer ${cust.name}:`, setErr);
        }
      }
    }

    // Try to save seeding status to system_config, ignore if unauthorized
    try {
      await setDoc(configRef, { customersSeeded: true });
    } catch (setCfgErr) {
      console.warn("Could not write customerSeeding status to system_config (non-admin is expected to be unauthorized):", setCfgErr);
    }
  } catch (err) {
    console.error("Failed to seed default customers:", err);
  }
}
