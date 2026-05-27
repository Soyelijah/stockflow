// CartTab — premium checkout: doc + customer + payment + items + coupon + total.

function CartTab({ cart, onInc, onDec, onRemove, onClear, onCheckout, customer, onPickCustomer, registerOpen }) {
  const [docType, setDocType] = React.useState("boleta");
  const [paymentMethod, setPaymentMethod] = React.useState("efectivo");
  const [promoCode, setPromoCode] = React.useState("");
  const [coupon, setCoupon] = React.useState(null);
  const [couponError, setCouponError] = React.useState("");
  const [couponOpen, setCouponOpen] = React.useState(false);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = coupon ? (coupon.discountType === "percent" ? subtotal * (coupon.discountValue / 100) : coupon.discountValue) : 0;
  const total = Math.max(0, subtotal - discount);
  const needsCustomer = docType === "factura" && !customer;
  const blocked = !registerOpen || needsCustomer || cart.length === 0;

  const applyCoupon = () => {
    const found = COUPONS.find(c => c.code === promoCode.trim().toUpperCase());
    if (!found) { setCouponError("Cupón no encontrado o expirado"); return; }
    setCoupon(found); setCouponError("");
  };

  if (cart.length === 0) {
    return (
      <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:18}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Tu Carrito</h2>
        <div className="sf-card-soft" style={{padding:32,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{
            width:80,height:80,borderRadius:24,
            background:"linear-gradient(140deg,#eef2ff,#fafbff)",
            display:"flex",alignItems:"center",justifyContent:"center",color:"var(--sf-indigo-500)",
            boxShadow:"inset 0 0 0 1px var(--sf-indigo-100)",
          }}>
            <Icon name="ShoppingCart" size={36} />
          </div>
          <p style={{font:"900 13px/1.2 Inter",margin:0}}>Carrito Vacío</p>
          <p style={{font:"500 12px/1.4 Inter",color:"var(--sf-fg-3)",margin:0,maxWidth:240}}>Escanea un código o entra al catálogo para agregar productos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-tab-in" style={{padding:"0 16px 12px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Tu Carrito</h2>
        <button onClick={onClear} style={{background:"none",border:"none",font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-danger)",cursor:"pointer"}}>Vaciar</button>
      </div>

      {/* DOC + CUSTOMER */}
      <div className="sf-card-soft" style={{padding:14,display:"flex",flexDirection:"column",gap:14}}>
        <div className="sf-segmented" style={{width:"100%"}}>
          <button className={docType==="boleta"?"active":""} style={{flex:1}} onClick={() => setDocType("boleta")}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Icon name="Ticket" size={13}/> Boleta</span>
          </button>
          <button className={docType==="factura"?"active":""} style={{flex:1}} onClick={() => setDocType("factura")}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Icon name="FileText" size={13}/> Factura</span>
          </button>
        </div>

        <button onClick={onPickCustomer} className="sf-tap" style={{
          width:"100%",padding:12,borderRadius:14,
          border:`1px solid ${customer ? "var(--sf-indigo-200)" : "var(--sf-stroke-1)"}`,
          background: customer ? "#fbfbff" : "var(--sf-slate-50)",
          display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <IconChip name="Users" palette={customer ? "indigo" : "slate"} size={36} icSize={16} />
            <div style={{minWidth:0}}>
              <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>
                {docType === "factura" ? "Cliente · Obligatorio" : "Cliente · Opcional"}
              </div>
              <div style={{font:"800 13px/1.2 Inter",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:customer?"var(--sf-fg-1)":"var(--sf-fg-3)"}}>
                {customer ? customer.name : "Venta General"}
              </div>
              {customer && (
                <div style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-fg-4)",marginTop:4}}>RUT {customer.rut}</div>
              )}
            </div>
          </div>
          <Icon name={customer ? "ChevronRight" : "Plus"} size={16} style={{color:"var(--sf-fg-4)"}}/>
        </button>
      </div>

      {/* PAYMENT METHODS */}
      <div>
        <div className="sf-section-h" style={{marginBottom:8}}>
          <span className="lbl">Método de pago</span>
          <span style={{font:"700 11px/1 Inter",color:"var(--sf-fg-4)"}}>Cliente paga con</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <PayTile active={paymentMethod==="efectivo"} onClick={()=>setPaymentMethod("efectivo")} icon="Banknote" label="Efectivo" palette="emerald"/>
          <PayTile active={paymentMethod==="tarjeta"}  onClick={()=>setPaymentMethod("tarjeta")}  icon="CreditCard" label="Tarjeta" palette="blue"/>
          <PayTile active={paymentMethod==="transferencia"} onClick={()=>setPaymentMethod("transferencia")} icon="RefreshCw" label="Transf." palette="amber"/>
          <PayTile active={paymentMethod==="digital"} onClick={()=>setPaymentMethod("digital")} icon="Smartphone" label="Virtual" palette="indigo"/>
        </div>
      </div>

      {/* LINE ITEMS */}
      <div>
        <div className="sf-section-h" style={{marginBottom:8}}>
          <span className="lbl">{cart.length} ítem{cart.length===1?"":"s"} en el carrito</span>
          <span style={{font:"900 10px/1 Inter",color:"var(--sf-fg-4)"}}>subt {CLP(subtotal)}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {cart.map((item, i) => (
            <div key={item.id} className="sf-card-soft sf-item-in" style={{padding:12,display:"flex",alignItems:"center",gap:10,animationDelay:`${i*30}ms`}}>
              <div style={{
                width:42,height:42,borderRadius:12,
                background:"linear-gradient(140deg,#eef2ff,#f5f3ff)",
                color:"var(--sf-indigo-700)",font:"900 16px/1 Inter",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>{item.name.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:3}} className="sf-tnum">{CLP(item.price)} · {item.qty} u · {CLP(item.price*item.qty)}</div>
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:3,background:"var(--sf-slate-50)",border:"1px solid var(--sf-stroke-1)",borderRadius:10}}>
                <StepperBtn onClick={() => item.qty === 1 ? onRemove(item) : onDec(item)}><Icon name="Minus" size={11}/></StepperBtn>
                <span style={{font:"900 12px/1 Inter",minWidth:16,textAlign:"center"}}>{item.qty}</span>
                <StepperBtn onClick={() => onInc(item)}><Icon name="Plus" size={11}/></StepperBtn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COUPON */}
      <div className="sf-card-soft" style={{padding:14}}>
        <button onClick={() => setCouponOpen(o => !o)} style={{
          width:"100%",background:"none",border:"none",padding:0,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <IconChip name="Ticket" palette="indigo" size={36} icSize={16} />
            <div style={{textAlign:"left"}}>
              <div style={{font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-2)"}}>¿Tienes un cupón?</div>
              <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:4}}>{coupon ? `${coupon.code} · −${coupon.discountType==="percent"?coupon.discountValue+"%":CLP(coupon.discountValue)}` : "Toca para aplicar un código"}</div>
            </div>
          </div>
          <Icon name="ChevronRight" size={16} style={{color:"var(--sf-fg-4)",transform:couponOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform 200ms"}}/>
        </button>
        {couponOpen && (
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:8}}>
              <input className="sf-input" value={promoCode} onChange={e => { setPromoCode(e.target.value); setCouponError(""); }}
                placeholder="CÓDIGO" style={{flex:1,textTransform:"uppercase",letterSpacing:"0.1em"}}/>
              <button onClick={applyCoupon} className="sf-tap" style={{
                padding:"0 18px",background:"var(--sf-indigo-600)",color:"white",border:"none",borderRadius:14,
                font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",cursor:"pointer",
              }}>Aplicar</button>
            </div>
            {couponError && <p style={{font:"700 10px/1.3 Inter",color:"var(--sf-danger)",margin:0}}>⚠️ {couponError}</p>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {COUPONS.slice(0,3).map(c => (
                <button key={c.code} onClick={() => { setPromoCode(c.code); setCoupon(c); setCouponError(""); }} className="sf-tap" style={{
                  background:"var(--sf-indigo-50)",border:"1px solid var(--sf-indigo-100)",color:"var(--sf-indigo-700)",
                  borderRadius:10,padding:"6px 10px",cursor:"pointer",
                  font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.1em",display:"inline-flex",gap:5,alignItems:"center",
                }}>
                  <span style={{fontSize:13}}>{c.img}</span>{c.code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TOTAL & CTA */}
      <div style={{
        background:"linear-gradient(140deg,#0f172a 0%, #1e1b4b 100%)",
        color:"white",borderRadius:26,padding:20,display:"flex",flexDirection:"column",gap:14,
        boxShadow:"0 14px 32px -10px rgba(15,23,42,0.45)",
      }}>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{font:"900 9px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.55)"}}>Subtotal</span>
          <span style={{font:"800 12px/1 Inter",color:"rgba(255,255,255,0.85)"}} className="sf-tnum">{CLP(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{font:"900 9px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"#34d399"}}>Descuento ({coupon.code})</span>
            <span style={{font:"800 12px/1 Inter",color:"#34d399"}} className="sf-tnum">−{CLP(discount)}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.65)"}}>Total a cobrar</div>
            <div style={{font:"900 11px/1.2 Inter",color:"rgba(255,255,255,0.4)",marginTop:5}}>IVA incluido · {docType.toUpperCase()}</div>
          </div>
          <MoneyTicker value={total} style={{font:"900 30px/1 Inter",color:"white",letterSpacing:"-0.025em",display:"block"}}/>
        </div>
        <button
          onClick={() => onCheckout({ docType, paymentMethod, total, items: cart, customer, coupon })}
          disabled={blocked}
          className="sf-tap"
          style={{
            width:"100%",height:56,marginTop:6,
            background: blocked ? "rgba(255,255,255,0.12)" : "white",
            color: blocked ? "rgba(255,255,255,0.45)" : "var(--sf-slate-900)",
            border:"none",borderRadius:18,
            font:"900 12px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            cursor: blocked ? "not-allowed" : "pointer",
          }}>
          <Icon name="Check" size={16} strokeWidth={3}/> Cobrar {CLP(total)}
        </button>
        {needsCustomer && <p style={{textAlign:"center",font:"800 10px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"#fda4af",margin:0}}>Se requiere cliente para Factura</p>}
        {!registerOpen && <p style={{textAlign:"center",font:"800 10px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"#fda4af",margin:0}}>🔒 Caja cerrada · abre tu turno en Perfil</p>}
      </div>
    </div>
  );
}

function PayTile({ active, onClick, icon, label, palette }) {
  const p = {
    emerald: { bg:"#ecfdf5", border:"#a7f3d0", fg:"#059669" },
    blue:    { bg:"#eff6ff", border:"#bfdbfe", fg:"#2563eb" },
    amber:   { bg:"#fffbeb", border:"#fde68a", fg:"#d97706" },
    indigo:  { bg:"#eef2ff", border:"#c7d2fe", fg:"#4f46e5" },
  }[palette];
  return (
    <button onClick={onClick} className="sf-tap" style={{
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      padding:"12px 8px",borderRadius:14,
      border:`1px solid ${active ? p.border : "var(--sf-stroke-1)"}`,
      background: active ? p.bg : "white",
      color: active ? p.fg : "var(--sf-fg-4)",
      cursor:"pointer",
      boxShadow: active ? `0 2px 6px -2px ${p.fg}40` : "0 1px 2px rgba(15,23,42,0.04)",
    }}>
      <Icon name={icon} size={20} strokeWidth={2.2}/>
      <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</span>
    </button>
  );
}

window.CartTab = CartTab;
window.PayTile = PayTile;
