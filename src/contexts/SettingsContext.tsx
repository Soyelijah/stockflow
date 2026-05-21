import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";

interface Settings {
  businessName: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  taxEnabled: boolean;
  taxRate: number;
  aiEnabled: boolean;
  notificationsEnabled: boolean;
  printerType: 'thermal' | 'regular' | 'none';
  printerInterface: 'usb' | 'bluetooth' | 'network' | 'system';
  autoPrintInvoice: boolean;
  deliveryEnabled: boolean;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
}

const defaultSettings: Settings = {
  businessName: "StockFlow Pro",
  email: "",
  phone: "",
  address: "",
  currency: "CLP",
  taxEnabled: true,
  taxRate: 19,
  aiEnabled: false,
  notificationsEnabled: true,
  printerType: 'thermal',
  printerInterface: 'system',
  autoPrintInvoice: false,
  deliveryEnabled: true
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, "settings", "global"), (doc) => {
      if (doc.exists()) {
        setSettings({
          ...defaultSettings,
          ...doc.data()
        } as Settings);
      } else {
        setSettings(defaultSettings);
      }
      setLoading(false);
    }, (error) => {
      console.error("Settings error:", error);
      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
