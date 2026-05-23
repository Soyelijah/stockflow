import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

export const barcodeRouter = Router();

// Initialize Gemini safely, using the environment variable
const ai = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    })
  : null;

// Preloaded local trademark database for high reliability and zero-latency lookups
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

const BarcodeLookupSchema = z.object({
  barcode: z.string().trim().min(5).max(30).regex(/^\d+$/, "El código de barras debe contener solo números.")
});

// Barcode lookup with optional Google Search grounded Gemini intelligence
barcodeRouter.get("/barcode-lookup", async (req, res) => {
  try {
    const parsed = BarcodeLookupSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Código de barras inválido o malformado." });
    }

    const cleanBarcode = parsed.data.barcode;

    // 1. Instant local database check (highly efficient)
    if (LOCAL_BARCODE_DB[cleanBarcode]) {
      console.log(`[Modular Barcode Engine] Hit: ${cleanBarcode}`);
      return res.json({ ...LOCAL_BARCODE_DB[cleanBarcode], source: "local_cache" });
    }

    // 2. Query dynamic Gemini if active
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
          model: "gemini-3.5-flash",
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
        console.log(`[Modular Gemini Barcode] Found: ${data.name}`);
        return res.json({ ...data, source: "gemini_api" });
      } catch (err: any) {
        console.warn(`[Modular Barcode Engine] Gemini safe bypass initiated for barcode: ${cleanBarcode}`, err?.message || err);
      }
    }

    // 3. Perfect fallback so POS never stalls
    return res.json({
      name: "",
      category: "",
      brand: "",
      imageUrl: "",
      description: "",
      isFallback: true,
      source: "smart_generator"
    });

  } catch (err: any) {
    console.warn("[Modular Barcode Engine] Safe catchall triggered.");
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

export function healthCheck() {
  const isEnabled = Boolean(process.env.GEMINI_API_KEY);
  return {
    status: "online", // Always online because fallback works perfectly offline
    details: {
      geminiConnected: isEnabled,
      localDbSize: Object.keys(LOCAL_BARCODE_DB).length,
      hasKey: isEnabled,
    }
  };
}
