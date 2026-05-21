export interface PhysicalReward {
  id: string;
  name: string;
  pointsCost: number;
  category: "Bebidas" | "Lácteos" | "Snacks" | "Merch" | "Otros";
  emoji: string;
  description: string;
  estimatedValueClp: number;
}

export const PHYSICAL_REWARDS_CATALOGUE: PhysicalReward[] = [
  {
    id: "rew-corona-pack",
    name: "Pack 6 Cervezas Corona (Botella 355cc)",
    pointsCost: 750,
    category: "Bebidas",
    emoji: "🍺",
    description: "Cerveza rubia tipo pilsen lager mexicana, ideal para compartir.",
    estimatedValueClp: 7500
  },
  {
    id: "rew-torobayo-pack",
    name: "Pack 6 Cervezas Kunsman Torobayo 330cc",
    pointsCost: 950,
    category: "Bebidas",
    emoji: "🍺",
    description: "Cerveza artesanal chilena de color ámbar y aroma a caramelos.",
    estimatedValueClp: 9900
  },
  {
    id: "rew-sutil-v",
    name: "Vino CA Sutil Cabernet Sauvignon 750ml",
    pointsCost: 1200,
    category: "Bebidas",
    emoji: "🍷",
    description: "Vino tinto de cuerpo equilibrado con notas a frutos rojos maduros.",
    estimatedValueClp: 12500
  },
  {
    id: "rew-valdivieso-es",
    name: "Espumante ME Valdivieso Brut 750ml",
    pointsCost: 1400,
    category: "Bebidas",
    emoji: "🍾",
    description: "Espumante de sutil burbuja con notas a manzana verde y pan tostado.",
    estimatedValueClp: 15500
  },
  {
    id: "rew-pisco-capel",
    name: "Pisco Capel de Guarda Especial 35° (750cc)",
    pointsCost: 800,
    category: "Bebidas",
    emoji: "🍸",
    description: "Pisco estacionado en roble americano de gran aroma.",
    estimatedValueClp: 8500
  },
  {
    id: "rew-alto-del-carmen",
    name: "Pisco Alto del Carmen Reservado 40° (750cc)",
    pointsCost: 1100,
    category: "Bebidas",
    emoji: "🥃",
    description: "Pisco prémium con notas amaderadas de uvas moscatel.",
    estimatedValueClp: 11900
  },
  {
    id: "rew-queso",
    name: "Queso Mantecoso Familiar Campo (500g)",
    pointsCost: 650,
    category: "Lácteos",
    emoji: "🧀",
    description: "Elaborado tradicionalmente, de gran cremosidad y sabor suave.",
    estimatedValueClp: 6900
  },
  {
    id: "rew-copas-cristal",
    name: "Set x2 Copas de Vino de Cristal StockFlow",
    pointsCost: 1600,
    category: "Merch",
    emoji: "🥂",
    description: "Copas oficiales de la casa con grabado elegante para tus catas.",
    estimatedValueClp: 18000
  },
  {
    id: "rew-destapador",
    name: "Destapador de Sommelier Profesional Acero",
    pointsCost: 350,
    category: "Merch",
    emoji: "⚙️",
    description: "Destapador de vino ergonómico con cortacápsulas de acero inoxidable.",
    estimatedValueClp: 3900
  },
  {
    id: "rew-carbon",
    name: "Saco Carbón Vegetal Premium de Espino (3kg)",
    pointsCost: 400,
    category: "Otros",
    emoji: "🔥",
    description: "Carbón de encendido rápido y gran duración para asados perfectos.",
    estimatedValueClp: 4500
  }
];
