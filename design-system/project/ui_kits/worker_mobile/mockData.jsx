// Mock data for the StockFlow worker app prototype.

const CLP = (n) => "$" + Math.round(n).toLocaleString("es-CL");

const CATEGORIES = ["Todos", "Bebidas", "Snacks", "Lácteos", "Panadería", "Despensa", "Limpieza"];

const PRODUCTS = [
  { id: "p1",  cat: "Bebidas",   name: "Coca‑Cola 1.5L Retornable", price: 1890, sku: "CC-1500R", stock: 24 },
  { id: "p2",  cat: "Bebidas",   name: "Sprite 1.5L Retornable",     price: 1690, sku: "SP-1500R", stock: 18 },
  { id: "p3",  cat: "Bebidas",   name: "Agua mineral CCU 500ml",     price: 690,  sku: "CCU-500",  stock: 56 },
  { id: "p4",  cat: "Bebidas",   name: "Cerveza Cristal 350ml",      price: 1290, sku: "CR-350",   stock: 5  },
  { id: "p5",  cat: "Lácteos",   name: "Leche entera Soprole 1L",    price: 1290, sku: "SOP-L1",   stock: 0  },
  { id: "p6",  cat: "Lácteos",   name: "Yogur Colun Frutilla 110g",  price: 590,  sku: "COL-FR1",  stock: 32 },
  { id: "p7",  cat: "Lácteos",   name: "Mantequilla Soprole 250g",   price: 2790, sku: "SOP-M25",  stock: 9  },
  { id: "p8",  cat: "Panadería", name: "Pan amasado · unidad",        price: 350,  sku: "PAN-AM01", stock: 4  },
  { id: "p9",  cat: "Panadería", name: "Hallulla · unidad",           price: 320,  sku: "PAN-HA01", stock: 28 },
  { id: "p10", cat: "Panadería", name: "Marraqueta · unidad",         price: 290,  sku: "PAN-MA01", stock: 36 },
  { id: "p11", cat: "Snacks",    name: "Papas Marco Polo 35g",        price: 690,  sku: "MP-35",    stock: 22 },
  { id: "p12", cat: "Snacks",    name: "Galletas Tritón vainilla",    price: 890,  sku: "TR-VAI",   stock: 14 },
  { id: "p13", cat: "Snacks",    name: "Chocolate Sahne‑Nuss 40g",    price: 990,  sku: "SH-40",    stock: 8  },
  { id: "p14", cat: "Despensa",  name: "Arroz Tucapel 1kg",           price: 1690, sku: "TU-1KG",   stock: 17 },
  { id: "p15", cat: "Despensa",  name: "Aceite Belmont 1L",           price: 2890, sku: "BE-1L",    stock: 11 },
  { id: "p16", cat: "Despensa",  name: "Fideos Carozzi spaghetti 400g", price: 990, sku: "CA-400", stock: 25 },
  { id: "p17", cat: "Limpieza",  name: "Detergente Omo 800g",         price: 3490, sku: "OMO-800",  stock: 6  },
  { id: "p18", cat: "Limpieza",  name: "Cloro Clorox 1L",             price: 1890, sku: "CLX-1L",   stock: 14 },
];

const CUSTOMERS = [
  { id: "c1", name: "Camila Rojas Mardones", rut: "18.234.512-9", email: "c.rojas@correo.cl", phone: "+56 9 8742 1098", points: 1280, tier: "GOLD" },
  { id: "c2", name: "Juan Pérez Salazar",    rut: "12.876.453-K", email: "j.perez@correo.cl", phone: "+56 9 7621 3490", points: 540,  tier: "SILVER" },
  { id: "c3", name: "Distribuidora El Roble Ltda.", rut: "76.543.210-1", email: "ventas@elroble.cl", phone: "+56 2 2345 6789", points: 0, tier: "BUSINESS" },
];

const PROFILE = {
  name: "María González",
  initial: "M",
  role: "seller",
  roleLabel: "Asesor Comercial",
  branchLabel: "Sucursal Centro",
  email: "m.gonzalez@stockflow.com",
};

// Per-role identity overrides
const ROLE_PROFILES = {
  vendedor:  { name:"María González",       initial:"M", roleLabel:"Asesor Comercial",     email:"m.gonzalez@stockflow.com" },
  jefe:      { name:"Roberto Quintana",     initial:"R", roleLabel:"Jefe de Local",         email:"r.quintana@stockflow.com" },
  logistica: { name:"Felipe Soto",          initial:"F", roleLabel:"Operador Logístico",   email:"f.soto@stockflow.com" },
  admin:     { name:"Andrea Cifuentes",     initial:"A", roleLabel:"Administrador General", email:"a.cifuentes@stockflow.com" },
};

// Role display labels (Spanish, what user sees)
const ROLE_LABELS = {
  vendedor:  "Vendedor",
  jefe:      "Jefe",
  logistica: "Logística",
  admin:     "Admin",
};

// Tabs per role: id, label, icon. Position 2 is reserved for FAB.
const ROLE_TABS = {
  vendedor: [
    { id:"home",    label:"Inicio",  icon:"Zap" },
    { id:"shop",    label:"Tienda",  icon:"Store" },
    { id:"cart",    label:"Carrito", icon:"ShoppingCart", badgeCart:true },
    { id:"profile", label:"Perfil",  icon:"User" },
  ],
  jefe: [
    { id:"home",    label:"Resumen", icon:"PieChart" },
    { id:"team",    label:"Equipo",  icon:"Users" },
    { id:"reports", label:"Reportes",icon:"Activity" },
    { id:"profile", label:"Perfil",  icon:"User" },
  ],
  logistica: [
    { id:"home",      label:"Hoy",        icon:"Truck" },
    { id:"transfers", label:"Traslados",  icon:"RefreshCw" },
    { id:"kardex",    label:"Kardex",     icon:"Package" },
    { id:"profile",   label:"Perfil",     icon:"User" },
  ],
  admin: [
    { id:"home",     label:"Negocio", icon:"PieChart" },
    { id:"branches", label:"Sucurs.", icon:"Building2" },
    { id:"users",    label:"Equipo",  icon:"Users" },
    { id:"profile",  label:"Perfil",  icon:"User" },
  ],
};

// FAB config per role
const ROLE_FAB = {
  vendedor:  { ic:"Zap",    label:"Cobrar",          target:"cart" },
  jefe:      { ic:"Check",  label:"Aprobar arqueo",  target:"team" },
  logistica: { ic:"Plus",   label:"Nueva entrega",   target:"transfers" },
  admin:     { ic:"Plus",   label:"Crear",           target:"branches" },
};

const COUPONS = [
  { code: "CUMPLE10", title: "10% Cumpleaños",  discountType: "percent", discountValue: 10, requiredPoints: 0,    img: "🎂" },
  { code: "VIP15",     title: "15% Cliente VIP", discountType: "percent", discountValue: 15, requiredPoints: 1000, img: "👑" },
  { code: "BIENVENIDA", title: "$1.000 Bienvenida", discountType: "fixed", discountValue: 1000, requiredPoints: 0, img: "🎁" },
];

// Today's sales activity — used by the Home hero & feed
const SALES_TARGET = 500000;

// Hourly sales for inline sparkline (08:00 → 22:00)
const HOURLY_SALES = [
  { h: "08", v: 0 },     { h: "09", v: 8400 },  { h: "10", v: 14200 },
  { h: "11", v: 22800 }, { h: "12", v: 31500 }, { h: "13", v: 38900 },
  { h: "14", v: 18200 }, { h: "15", v: 24500 }, { h: "16", v: 29400 },
  { h: "17", v: 33800 }, { h: "18", v: 41200 }, { h: "19", v: 35900 },
  { h: "20", v: 27300 }, { h: "21", v: 14800 }, { h: "22", v: 5200 },
];

// Daily stats for "this week" mini chart
const WEEK_SALES = [
  { d: "L", v: 320000 }, { d: "M", v: 285000 }, { d: "X", v: 410000 },
  { d: "J", v: 380000 }, { d: "V", v: 510000 }, { d: "S", v: 489000 },
  { d: "D", v: 245890 },
];

const TRANSACTIONS = [
  { id: "TX-847291036", at: "22:18", customer: "Camila Rojas",   doc: "boleta",  method: "tarjeta",      amount: 4690 },
  { id: "TX-847290981", at: "21:47", customer: "Venta General",  doc: "boleta",  method: "efectivo",     amount: 1690 },
  { id: "TX-847290743", at: "21:32", customer: "Distrib. El Roble", doc: "factura", method: "transferencia", amount: 38240 },
  { id: "TX-847290492", at: "20:51", customer: "Venta General",  doc: "boleta",  method: "efectivo",     amount: 990 },
  { id: "TX-847290218", at: "20:13", customer: "Juan Pérez",     doc: "boleta",  method: "digital",      amount: 8890 },
  { id: "TX-847289734", at: "19:42", customer: "Venta General",  doc: "boleta",  method: "tarjeta",      amount: 2790 },
];

const NOTIFICATIONS = [
  { id: "n1", type: "warning", title: "Stock crítico",   message: "Leche entera Soprole 1L está agotada", time: "Hace 8 min" },
  { id: "n2", type: "success", title: "Cierre aprobado", message: "Cuadratura del turno anterior conforme", time: "Hace 2 hr" },
  { id: "n3", type: "info",    title: "Nueva campaña",   message: "Cupón CUMPLE10 disponible esta semana", time: "Ayer 18:30" },
];

const BRANCHES = [
  { id: "b1", name: "Sucursal Centro",      city: "Santiago" },
  { id: "b2", name: "Sucursal Providencia", city: "Santiago" },
  { id: "b3", name: "Sucursal Maipú",       city: "Santiago" },
];

// ===== JEFE (Store Manager) data =====
const TEAM_MEMBERS = [
  { id:"t1", name:"María González",     initial:"M", role:"Vendedor",         status:"selling",   sales: 245890, count: 12, avg: 20491, target: 500000 },
  { id:"t2", name:"Carlos Méndez",      initial:"C", role:"Vendedor",         status:"selling",   sales: 189420, count:  9, avg: 21047, target: 500000 },
  { id:"t3", name:"Sofía Vega",         initial:"S", role:"Vendedor",         status:"break",     sales: 132100, count:  7, avg: 18871, target: 500000 },
  { id:"t4", name:"Diego Vargas",       initial:"D", role:"Cajero",           status:"selling",   sales:  88450, count:  5, avg: 17690, target: 300000 },
  { id:"t5", name:"Ana Salinas",        initial:"A", role:"Vendedor jr.",     status:"offline",   sales:      0, count:  0, avg: 0,     target: 250000 },
];

// Pending approvals waiting for jefe sign-off
const PENDING_APPROVALS = [
  { id:"a1", type:"refund",    title:"Devolución",   detail:"$8.450 · Coca‑Cola 1.5L ×2",   seller:"María González",    time:"Hace 12 min", risk:"low" },
  { id:"a2", type:"discount",  title:"Descuento 20%", detail:"Cupón fuera de catálogo",      seller:"Carlos Méndez",     time:"Hace 38 min", risk:"med" },
  { id:"a3", type:"shift",     title:"Cierre de caja",detail:"Falta arqueo · diferencia $1.200", seller:"Sofía Vega",   time:"Hace 1 hr",   risk:"high" },
];

// ===== LOGÍSTICA data =====
const DELIVERIES = [
  { id:"d1", code:"DLV-2034", customer:"Distribuidora El Roble",   address:"Av. Providencia 1234", branch:"Centro",      items: 18, weight: "12.4 kg", eta: "11:30", status:"pending"  },
  { id:"d2", code:"DLV-2035", customer:"Almacén Don Lucho",         address:"Maipú 456",            branch:"Maipú",       items:  6, weight:  "4.8 kg", eta: "12:15", status:"intransit"},
  { id:"d3", code:"DLV-2036", customer:"Minimarket La Esquina",     address:"Pedro Aguirre 789",    branch:"Centro",      items: 23, weight: "18.1 kg", eta: "13:00", status:"pending"  },
  { id:"d4", code:"DLV-2037", customer:"Carnicería Los Andes",      address:"San Diego 2110",       branch:"Providencia", items:  4, weight:  "2.0 kg", eta: "09:45", status:"delivered"},
  { id:"d5", code:"DLV-2038", customer:"Almacén El Tata",           address:"Vicuña Mackenna 6400", branch:"Maipú",       items: 11, weight:  "7.6 kg", eta: "14:20", status:"pending"  },
];

const TRANSFERS = [
  { id:"tr1", code:"TR-9420", from:"Centro",      to:"Providencia", items: 24, status:"pending",   created:"08:15", driver:"Felipe Soto" },
  { id:"tr2", code:"TR-9419", from:"Centro",      to:"Maipú",       items: 18, status:"intransit", created:"07:30", driver:"Andrés Mella" },
  { id:"tr3", code:"TR-9418", from:"Providencia", to:"Centro",      items:  6, status:"received",  created:"Ayer",   driver:"Felipe Soto" },
  { id:"tr4", code:"TR-9417", from:"Maipú",       to:"Centro",      items: 12, status:"received",  created:"Ayer",   driver:"Andrés Mella" },
];

const KARDEX_MOVES = [
  { id:"k1", at:"22:18", sku:"CC-1500R", product:"Coca‑Cola 1.5L", type:"sale",     qty: -2, branch:"Centro", balance: 22, by:"María G." },
  { id:"k2", at:"21:45", sku:"SOP-L1",   product:"Leche Soprole 1L",type:"adjust",  qty: -1, branch:"Centro", balance:  0, by:"Felipe S." },
  { id:"k3", at:"20:12", sku:"PAN-AM01", product:"Pan amasado",    type:"transfer", qty:-12, branch:"Centro", balance:  4, by:"Felipe S." },
  { id:"k4", at:"18:30", sku:"TU-1KG",   product:"Arroz Tucapel 1kg",type:"receive",qty: 50, branch:"Centro", balance: 67, by:"Felipe S." },
  { id:"k5", at:"15:42", sku:"CR-350",   product:"Cerveza Cristal",type:"return",   qty:  3, branch:"Centro", balance:  8, by:"María G." },
  { id:"k6", at:"12:08", sku:"BE-1L",    product:"Aceite Belmont",  type:"sale",     qty: -1, branch:"Centro", balance: 10, by:"Carlos M." },
];

// Stock alerts visible to logistics + admin
const STOCK_ALERTS = [
  { id:"sa1", sku:"SOP-L1",   product:"Leche entera Soprole 1L", level:"out",      branch:"Centro",   stock: 0,  reorderAt: 12 },
  { id:"sa2", sku:"PAN-AM01", product:"Pan amasado",             level:"critical", branch:"Centro",   stock: 4,  reorderAt: 15 },
  { id:"sa3", sku:"CR-350",   product:"Cerveza Cristal 350ml",   level:"low",      branch:"Centro",   stock: 8,  reorderAt: 24 },
  { id:"sa4", sku:"OMO-800",  product:"Detergente Omo 800g",     level:"low",      branch:"Providencia", stock: 6, reorderAt: 18 },
];

// ===== ADMIN (multi-branch) data =====
const BRANCH_METRICS = [
  { id:"b1", name:"Centro",      sales: 1245890, target: 2000000, txns:  68, growth: 18,   sellers: 5, status:"healthy" },
  { id:"b2", name:"Providencia", sales:  892400, target: 1500000, txns:  41, growth:  6,   sellers: 3, status:"healthy" },
  { id:"b3", name:"Maipú",       sales:  624100, target: 1500000, txns:  28, growth: -4,   sellers: 3, status:"attention" },
];

const ADMIN_ALERTS = [
  { id:"al1", type:"warning", title:"Maipú bajo meta",         detail:"42% del objetivo semanal · 3 días restantes", time:"Hace 1 hr" },
  { id:"al2", type:"success", title:"Centro superó meta",      detail:"Cumplió 124% · pago de bono activado",        time:"Hace 4 hr" },
  { id:"al3", type:"info",    title:"Nuevo proveedor activo",  detail:"Distribuidora ACME · catálogo de 84 SKUs",     time:"Ayer 17:20" },
];

Object.assign(window, { CLP, CATEGORIES, PRODUCTS, CUSTOMERS, PROFILE, ROLE_PROFILES, ROLE_LABELS, ROLE_TABS, ROLE_FAB, COUPONS, SALES_TARGET, HOURLY_SALES, WEEK_SALES, TRANSACTIONS, NOTIFICATIONS, BRANCHES, TEAM_MEMBERS, PENDING_APPROVALS, DELIVERIES, TRANSFERS, KARDEX_MOVES, STOCK_ALERTS, BRANCH_METRICS, ADMIN_ALERTS });
