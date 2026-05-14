import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Package, 
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency } from "../lib/utils";

export function Inventory() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: 0,
    stock: 0,
    minThreshold: 5,
    description: "",
    category: ""
  });

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (Inventory)");
    });
    return unsub;
  }, []);

  const openModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || "",
        price: product.price,
        stock: product.stock,
        minThreshold: product.minThreshold,
        description: product.description || "",
        category: product.category || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        price: 0,
        stock: 0,
        minThreshold: 5,
        description: "",
        category: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        // Log transaction if stock changed
        const stockDiff = formData.stock - editingProduct.stock;
        
        const batch = writeBatch(db);
        const prodRef = doc(db, "products", editingProduct.id);
        
        batch.update(prodRef, {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        if (stockDiff !== 0) {
          const txRef = doc(collection(db, "transactions"));
          batch.set(txRef, {
            productId: editingProduct.id,
            productName: formData.name,
            type: stockDiff > 0 ? "in" : "out",
            quantity: Math.abs(stockDiff),
            userId: profile?.uid,
            userName: profile?.name,
            timestamp: serverTimestamp(),
            note: "Ajuste manual de inventario"
          });
        }

        await batch.commit();
      } else {
        const prodRef = await addDoc(collection(db, "products"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        // Initial transaction
        if (formData.stock > 0) {
          await addDoc(collection(db, "transactions"), {
            productId: prodRef.id,
            productName: formData.name,
            type: "in",
            quantity: formData.stock,
            userId: profile?.uid,
            userName: profile?.name,
            timestamp: serverTimestamp(),
            note: "Stock inicial"
          });
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "products");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Inventario</h2>
        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          id="add-product-btn"
        >
          <Plus size={20} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o SKU..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{product.name || "Sin nombre"}</p>
                        <p className="text-xs text-gray-500">{product.sku || "Sin SKU"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">
                    {formatCurrency(product.price || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-bold text-sm",
                      Number(product.stock) <= Number(product.minThreshold) ? "text-orange-600" : "text-gray-900"
                    )}>
                      {product.stock || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {Number(product.stock) <= 0 ? (
                      <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-full border border-red-100">Sin Stock</span>
                    ) : Number(product.stock) <= Number(product.minThreshold) ? (
                      <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold uppercase rounded-full border border-orange-100">Bajo Stock</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-full border border-green-100">Normal</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => openModal(product)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-12 text-center">
              <Package className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 italic">No se encontraron productos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU / Código</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio</label>
                  <input 
                    required
                    type="number" step="0.01"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Actual</label>
                  <input 
                    required
                    type="number" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alerta Stock Bajo</label>
                  <input 
                    required
                    type="number" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.minThreshold}
                    onChange={e => setFormData({...formData, minThreshold: Number(e.target.value)})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                  <textarea 
                    rows={3}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center space-x-2"
                >
                  <Save size={18} />
                  <span>{editingProduct ? "Actualizar" : "Guardar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
