import React from "react";
import { ShoppingCart, ArrowLeft, Tag, Minus, Plus, Trash2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, calculatePoints } from "../../../lib/utils";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: any[];
  appliedCoupon: any | null;
  couponInput: string;
  couponError: string | null;
  setCouponInput: (val: string) => void;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveFromCart: (id: string) => void;
  onSetCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onCheckout: () => void;
  lang: "es" | "en";
  t: any;
  cartTotal: number;
  couponDiscount: number;
  finalCartTotal: number;
  key?: React.Key;
}

export function CartSheet({
  isOpen,
  onClose,
  cart,
  products,
  appliedCoupon,
  couponInput,
  couponError,
  setCouponInput,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemoveFromCart,
  onSetCart,
  onCheckout,
  lang,
  t,
  cartTotal,
  couponDiscount,
  finalCartTotal
}: CartSheetProps) {
  const pointsToEarn = calculatePoints(finalCartTotal);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[90vh] relative"
            style={{ paddingBottom: "calc(2rem + var(--sa-bottom, env(safe-area-inset-bottom)))" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-x-3">
                <div className="size-10 bg-orange-600 rounded-xl flex items-center justify-center text-white">
                  <ShoppingCart size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-800">{t[lang].orderCartTitle}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 cursor-pointer transition-colors"
              >
                <ArrowLeft size={18} className="-rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mx-2 px-2 pb-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 font-bold">{t[lang].cartEmptyText}</p>
                </div>
              ) : (
                cart.map((item) => {
                  const product = products.find((p) => p.id === item.id);
                  const moq = product?.wholesaleMinQty || 6;
                  const isWholesale = item.quantity >= moq && product?.wholesalePrice;
                  const itemPrice = isWholesale ? product.wholesalePrice : item.price;

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-x-4"
                    >
                      <div className="size-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm overflow-hidden select-none">
                        {product?.image ? (
                          <img
                            src={product.image}
                            alt={product.name || "Producto"}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span aria-label={product?.name || "Producto"}>
                            {product?.category === "Bebidas"
                              ? "🥤"
                              : product?.category === "Lácteos"
                              ? "🧀"
                              : "🍎"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h4 className="text-[11px] font-black text-slate-800 line-clamp-1">
                          {item.name}
                        </h4>
                        <p className="text-[9px] font-bold text-slate-500">
                          {formatCurrency(itemPrice)} / un
                        </p>
                        {isWholesale && (
                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">
                            {t[lang].wholesalePricingBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 select-none shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="size-6 flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              onSetCart((prev) =>
                                prev
                                  .map((i) => (i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i))
                                  .filter((i) => i.quantity > 0)
                              );
                            }
                          }}
                          className="w-8 text-center bg-transparent border-none text-[10px] font-black text-slate-800 focus:ring-0 p-0"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="size-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFromCart(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-6 border-t border-slate-100 space-y-4 shrink-0">
                {/* Points Reward Banner */}
                {pointsToEarn > 0 && (
                  <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl flex items-center gap-2 text-left">
                    <span className="text-base select-none">✨</span>
                    <div>
                      <p className="text-[10px] font-black text-amber-950 uppercase tracking-wider leading-none">
                        {lang === "es" ? "Puntos a ganar" : "Points to earn"}
                      </p>
                      <p className="text-[9px] text-amber-800 font-bold mt-1 leading-snug">
                        {lang === "es"
                          ? `¡Con este pedido acumularás +${pointsToEarn} pts para canjear más cupones!`
                          : `With this order you will earn +${pointsToEarn} pts to redeem more coupons!`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Coupon section */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 text-left">
                    <Tag size={12} className="text-indigo-600" />
                    <span>{t[lang].hasCouponLabel}</span>
                  </p>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100/50 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-base select-none">{appliedCoupon.img || "🎟️"}</span>
                        <div>
                          <p className="text-[10px] font-black text-indigo-950 uppercase leading-none">
                            {appliedCoupon.code}
                          </p>
                          <p className="text-[9px] text-indigo-600 font-bold mt-1">
                            {appliedCoupon.desc}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onRemoveCoupon}
                        className="text-slate-400 hover:text-rose-500 font-black text-[10px] uppercase tracking-wider px-2 py-1 cursor-pointer transition-colors"
                      >
                        {t[lang].removeLabel}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t[lang].couponPlaceholder}
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => onApplyCoupon(couponInput)}
                          className="bg-indigo-600 text-white uppercase tracking-widest text-[9px] font-black px-4 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          {t[lang].applyLabel}
                        </button>
                      </div>
                      {couponError && (
                        <p className="text-[9px] text-rose-500 font-extrabold ml-1 text-left">
                          {couponError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-left">
                  {appliedCoupon && (
                    <>
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                        <span>{t[lang].subtotalLabel}</span>
                        <span className="font-mono">{formatCurrency(cartTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-600">
                        <span className="flex items-center gap-1">🎟️ {t[lang].discountLabel} ({appliedCoupon.code})</span>
                        <span className="font-mono">-{formatCurrency(couponDiscount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {t[lang].estimatedTotalLabel}
                    </span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {formatCurrency(finalCartTotal)}
                    </span>
                  </div>
                </div>

                {/* Primary Button preserving B.5 branding (Orange with elevation shadow) */}
                <button
                  type="button"
                  onClick={onCheckout}
                  className="sf-btn-cta sf-tap sf-spring w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-x-2 cursor-pointer"
                >
                  <span>{t[lang].finishCheckoutBtn}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
