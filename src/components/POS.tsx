import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  writeBatch, 
  doc, 
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2,
  Package,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency } from "../lib/utils";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxStock: number;
}

export function POS() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Fetch products ordered by name and handle errors
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (POS)");
    });
    return unsub;
  }, []);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        maxStock: product.stock 
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.maxStock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);

      for (const item of cart) {
        // Update product stock (decrease)
        const prodRef = doc(db, "products", item.id);
        batch.update(prodRef, {
          stock: increment(-item.quantity),
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        // Create transaction history
        const txRef = doc(collection(db, "transactions"));
        batch.set(txRef, {
          productId: item.id,
          productName: item.name,
          type: "out",
          quantity: item.quantity,
          userId: profile?.uid,
          userName: profile?.name,
          timestamp: serverTimestamp(),
          totalAmount: item.price * item.quantity,
          note: "Venta realizada desde el terminal de ventas"
        });
      }

      await batch.commit();
      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "checkout");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!p.name) return false;
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(searchLower);
    const skuMatch = p.sku && p.sku.toLowerCase().includes(searchLower);
    return p.stock > 0 && (nameMatch || skuMatch);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)] lg:h-auto">
      {/* Product Selection */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center space-x-4 sticky top-0 md:relative z-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-4">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-full aspect-square bg-blue-50 rounded-xl mb-3 flex items-center justify-center text-blue-200 group-hover:text-blue-400 transition-colors">
                <Package size={48} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 line-clamp-1 text-sm">{product.name || "Producto sin nombre"}</h4>
                <p className="text-blue-600 font-extrabold text-lg mt-1">{formatCurrency(product.price || 0)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                    Number(product.stock) <= Number(product.minThreshold) ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                  )}>
                    {product.stock || 0} disponibles
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <p className="text-gray-500 italic">No hay productos disponibles con stock.</p>
            </div>
          )}
        </div>
      </div>

      {/* Shopping Cart */}
      <div className="lg:col-span-4 lg:sticky lg:top-6 lg:h-fit">
        <div className="bg-white rounded-2xl border shadow-lg overflow-hidden flex flex-col h-full lg:h-auto min-h-[400px]">
          <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={20} className="text-blue-600" />
              Carrito de Venta
            </h3>
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{cart.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 font-medium">{formatCurrency(item.price)} x {item.quantity}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                      className="p-1 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-2 text-xs font-bold text-gray-900 min-w-[24px] text-center">{item.quantity}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                      className="p-1 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-30"
                      disabled={item.quantity >= item.maxStock}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center text-gray-400">
                <ShoppingCart size={48} className="mb-4 opacity-20" />
                <p className="text-sm italic">El carrito está vacío</p>
                <p className="text-xs">Agrega productos para realizar una venta</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 border-t space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Total</span>
              <span className="text-2xl font-black text-gray-900">{formatCurrency(cartTotal)}</span>
            </div>

            <button 
              disabled={cart.length === 0 || isProcessing}
              onClick={handleCheckout}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span>Procesar Venta</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center space-x-2 text-green-700 font-bold shadow-sm"
            >
              <CheckCircle2 size={20} />
              <span>Venta procesada con éxito</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
