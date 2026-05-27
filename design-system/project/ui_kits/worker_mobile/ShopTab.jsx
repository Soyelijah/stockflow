// ShopTab — premium catalog browser with category chips and animated rows.

function ShopTab({ products, cart, onAdd, onInc, onDec, onScan }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("Todos");

  const filtered = React.useMemo(() => products.filter(p => {
    const matchesCat = category === "Todos" || p.cat === category;
    const q = search.toLowerCase();
    const matchesQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  }), [products, category, search]);

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",color:"var(--sf-fg-1)",margin:0}}>Catálogo</h2>
        <Pill kind="accent">{filtered.length} productos</Pill>
      </div>

      {/* Search + scan row */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative",flex:1}}>
          <Icon name="Search" size={15} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--sf-slate-400)"}}/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o código…"
            className="sf-input" style={{paddingLeft:38,paddingRight:36}}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              width:24,height:24,borderRadius:9999,background:"var(--sf-slate-100)",
              border:"none",color:"var(--sf-fg-3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
            }}><Icon name="X" size={12}/></button>
          )}
        </div>
        <button onClick={onScan} className="sf-tap" style={{
          width:48,height:48,background:"var(--sf-indigo-600)",border:"none",
          borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",
          color:"white",flexShrink:0,cursor:"pointer",
          boxShadow:"0 8px 18px -8px rgba(79,70,229,0.55)",
        }}>
          <Icon name="Camera" size={18} />
        </button>
      </div>

      {/* Category chips */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none",margin:"0 -16px",padding:"0 16px 4px"}} className="sf-no-scrollbar">
        {CATEGORIES.map(c => {
          const active = c === category;
          return (
            <button key={c} onClick={() => setCategory(c)} className="sf-tap" style={{
              padding:"9px 14px",borderRadius:9999,flexShrink:0,
              font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.1em",
              background: active ? "var(--sf-slate-900)" : "white",
              color: active ? "white" : "var(--sf-fg-3)",
              border: `1px solid ${active ? "var(--sf-slate-900)" : "var(--sf-stroke-1)"}`,
              boxShadow: active ? "0 4px 12px rgba(15,23,42,0.18)" : "0 1px 2px rgba(15,23,42,0.04)",
              cursor:"pointer",
            }}>{c}</button>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map((p, i) => (
          <ProductRow key={p.id} product={p}
            cartItem={cart.find(ci => ci.id === p.id)}
            style={{animationDelay: `${Math.min(i, 6) * 35}ms`}}
            onAdd={() => onAdd(p)} onInc={() => onInc(p)} onDec={() => onDec(p)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{textAlign:"center",padding:"40px 0",color:"var(--sf-fg-4)"}}>
            <Icon name="Package" size={36} />
            <p style={{font:"900 11px/1.4 Inter",textTransform:"uppercase",letterSpacing:"0.14em",marginTop:10}}>Sin resultados</p>
            <p style={{font:"500 11px/1.4 Inter",marginTop:6}}>Prueba con otro término o categoría.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product, cartItem, onAdd, onInc, onDec, style }) {
  const isOut = product.stock <= 0;
  const isLow = product.stock > 0 && product.stock <= 5;
  const selected = !!cartItem;

  return (
    <div className={`sf-row sf-item-in ${selected ? "selected" : ""}`} style={style}>
      <div style={{
        width:48,height:48,borderRadius:14,
        background: selected ? "linear-gradient(140deg,#4f46e5,#6366f1)"
          : isOut ? "var(--sf-slate-100)" : "var(--sf-slate-50)",
        color: selected ? "white" : isOut ? "var(--sf-fg-4)" : "var(--sf-fg-2)",
        display:"flex",alignItems:"center",justifyContent:"center",
        font:"900 18px/1 Inter",flexShrink:0,
        boxShadow: selected ? "0 8px 16px -6px rgba(79,70,229,0.45)" : "none",
        transition:"all 200ms var(--sf-spring)",
      }}>{product.name.charAt(0)}</div>

      <div style={{flex:1,minWidth:0}}>
        <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{product.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
          <span style={{font:"900 13px/1 Inter",color: isOut ? "var(--sf-fg-4)" : "var(--sf-indigo-600)",letterSpacing:"-0.02em"}} className="sf-tnum">
            {CLP(product.price)}
          </span>
          <span style={{font:"700 9px/1.2 ui-monospace,monospace",color:"var(--sf-fg-4)",background:"var(--sf-slate-100)",padding:"1px 6px",borderRadius:6,textTransform:"uppercase"}}>{product.sku}</span>
        </div>
        <div style={{marginTop:5}}>
          {isOut ? <Pill kind="danger">✕ Agotado</Pill>
            : isLow ? <Pill kind="warning" pulse>⚠ Pocas ({product.stock})</Pill>
            : <Pill kind="success">✓ Disponible ({product.stock})</Pill>}
        </div>
      </div>

      <div style={{flexShrink:0}}>
        {cartItem ? (
          <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:4,background:"var(--sf-indigo-50)",border:"1px solid var(--sf-indigo-100)",borderRadius:12}}>
            <StepperBtn onClick={onDec}><Icon name="Minus" size={12} /></StepperBtn>
            <span style={{font:"900 13px/1 Inter",color:"var(--sf-indigo-900)",minWidth:18,textAlign:"center"}} className="sf-tnum">{cartItem.qty}</span>
            <StepperBtn onClick={onInc}><Icon name="Plus" size={12} /></StepperBtn>
          </div>
        ) : (
          <button onClick={() => !isOut && onAdd()} disabled={isOut} className="sf-tap" style={{
            width:40,height:40,borderRadius:14,
            background: isOut ? "var(--sf-slate-100)" : "linear-gradient(140deg,#4f46e5,#6366f1)",
            color: isOut ? "var(--sf-fg-4)" : "white",border:"none",
            boxShadow: isOut ? "none" : "0 6px 14px -4px rgba(79,70,229,0.5)",
            display:"flex",alignItems:"center",justifyContent:"center",
            cursor: isOut ? "not-allowed" : "pointer",
          }}>
            <Icon name="Plus" size={16} strokeWidth={2.8}/>
          </button>
        )}
      </div>
    </div>
  );
}

function StepperBtn({ children, onClick }) {
  return (
    <button onClick={onClick} className="sf-tap" style={{
      width: 28, height: 28, borderRadius: 9, background: "white",
      border: "1px solid var(--sf-stroke-1)", color: "var(--sf-indigo-600)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

window.ShopTab = ShopTab;
window.ProductRow = ProductRow;
