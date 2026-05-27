// Sheets.jsx — bottom sheets: ShiftOpen, Customer, Notifications, BranchSwitcher.

function SheetShell({ open, onClose, dark = false, title, subtitle, children, height }) {
  const [mounted, setMounted] = React.useState(false);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const id = setTimeout(() => setShow(true), 20);
      return () => clearTimeout(id);
    } else if (mounted) {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 420);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <>
      <div className={`sf-scrim-bg ${show ? "open" : ""}`} onClick={onClose}/>
      <div className={`sf-sheet ${show ? "open" : ""} ${dark ? "dark" : ""}`} style={{height: height || "auto"}}>
        <div className="sf-sheet-handle"/>
        <div style={{padding:"4px 22px 12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div>
            {title && <div style={{font:"900 18px/1.1 Inter",letterSpacing:"-0.02em",color:dark?"white":"var(--sf-fg-1)"}}>{title}</div>}
            {subtitle && <div style={{font:"700 10px/1.4 Inter",color:dark?"rgba(255,255,255,0.6)":"var(--sf-fg-4)",marginTop:5,textTransform:"uppercase",letterSpacing:"0.12em"}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="sf-tap" style={{
            width:32,height:32,borderRadius:10,
            background:dark?"rgba(255,255,255,0.08)":"var(--sf-slate-100)",
            border:"none",color:dark?"white":"var(--sf-fg-2)",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}><Icon name="X" size={14}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"4px 22px 24px"}}>
          {children}
        </div>
      </div>
    </>
  );
}

// ---------- ShiftOpenSheet ----------
function ShiftOpenSheet({ open, onClose, onConfirm }) {
  const [amount, setAmount] = React.useState(100000);
  if (!open) return null;
  return (
    <SheetShell open={open} onClose={onClose} title="Abrir caja · iniciar turno" subtitle="Declara el fondo inicial en efectivo">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="sf-card-soft" style={{padding:16,background:"linear-gradient(140deg,#fbfbff,white)"}}>
          <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>Efectivo de apertura</div>
          <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:8}}>
            <span style={{font:"900 22px/1 Inter",color:"var(--sf-fg-4)"}}>$</span>
            <input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value)||0)} style={{
              flex:1,font:"900 32px/1 Inter",letterSpacing:"-0.025em",color:"var(--sf-fg-1)",
              border:"none",outline:"none",background:"transparent",fontVariantNumeric:"tabular-nums",minWidth:0,
            }}/>
          </div>
          <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
            {[50000,100000,150000,200000].map(v => (
              <button key={v} onClick={()=>setAmount(v)} className="sf-tap" style={{
                background: amount===v?"var(--sf-indigo-600)":"var(--sf-slate-50)",
                color: amount===v?"white":"var(--sf-fg-2)",
                border:`1px solid ${amount===v?"var(--sf-indigo-600)":"var(--sf-stroke-1)"}`,
                borderRadius:9999,padding:"6px 12px",cursor:"pointer",
                font:"900 10px/1 Inter",letterSpacing:"-0.01em",fontVariantNumeric:"tabular-nums",
              }}>${(v/1000).toFixed(0)}K</button>
            ))}
          </div>
        </div>

        <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8}}>
          {[
            { ic: "ShieldCheck", t: "Auditado por el sistema", s: "Cada movimiento queda en el kardex" },
            { ic: "Coins",       t: "Tu comisión se acumula", s: "2.5% sobre ventas registradas" },
            { ic: "Lock",        t: "Cierre y arqueo al final", s: "Cuadratura automática contra ventas" },
          ].map((b,i) => (
            <li key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"4px 0"}}>
              <IconChip name={b.ic} palette="indigo" size={36} icSize={15}/>
              <div>
                <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>{b.t}</div>
                <div style={{font:"700 11px/1.3 Inter",color:"var(--sf-fg-3)",marginTop:3}}>{b.s}</div>
              </div>
            </li>
          ))}
        </ul>

        <button onClick={() => onConfirm(amount)} className="sf-btn-cta" style={{marginTop:6}}>
          <Icon name="Unlock" size={14}/> Iniciar turno con {CLP(amount)}
        </button>
      </div>
    </SheetShell>
  );
}

// ---------- CustomerSheet ----------
function CustomerSheet({ open, onClose, onPick, customer }) {
  const [q, setQ] = React.useState("");
  const filtered = CUSTOMERS.filter(c =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.rut.toLowerCase().includes(q.toLowerCase())
  );
  if (!open) return null;
  return (
    <SheetShell open={open} onClose={onClose} title="Seleccionar cliente" subtitle="Para facturación o fidelización" height="78%">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{position:"relative"}}>
          <Icon name="Search" size={15} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--sf-slate-400)"}}/>
          <input className="sf-input" placeholder="Buscar por nombre o RUT…" value={q} onChange={e=>setQ(e.target.value)} style={{paddingLeft:38}}/>
        </div>

        <button className="sf-tap" onClick={() => { onPick(null); onClose(); }} style={{
          width:"100%",padding:14,borderRadius:16,
          background:"var(--sf-slate-50)",border:"1px solid var(--sf-stroke-1)",
          display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",
        }}>
          <IconChip name="Users" palette="slate" size={40} icSize={16}/>
          <div style={{flex:1}}>
            <div style={{font:"900 12px/1 Inter",color:"var(--sf-fg-1)"}}>Venta General · sin cliente</div>
            <div style={{font:"700 11px/1.3 Inter",color:"var(--sf-fg-3)",marginTop:5}}>Solo para boleta · sin acumular puntos</div>
          </div>
        </button>

        <div className="sf-section-h"><span className="lbl">Clientes recientes</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(c => {
            const selected = customer && customer.id === c.id;
            return (
              <button key={c.id} onClick={() => { onPick(c); onClose(); }} className="sf-tap" style={{
                width:"100%",padding:14,borderRadius:16,cursor:"pointer",textAlign:"left",
                background: selected ? "#fbfbff" : "white",
                border: `1px solid ${selected ? "var(--sf-indigo-200)" : "var(--sf-stroke-1)"}`,
                display:"flex",alignItems:"center",gap:12,
                boxShadow:"0 1px 2px rgba(15,23,42,0.04)",
              }}>
                <Avatar initial={c.name.charAt(0)} size={40} palette="indigoSolid"/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{font:"900 13px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:5,flexWrap:"wrap"}}>
                    <span style={{font:"700 10px/1.2 ui-monospace,monospace",color:"var(--sf-fg-4)"}}>{c.rut}</span>
                    {c.points > 0 && <Pill kind="accent">{c.points} pts</Pill>}
                    <Pill kind={c.tier==="BUSINESS"?"neutral":c.tier==="GOLD"?"warning":"accent"}>{c.tier}</Pill>
                  </div>
                </div>
                <Icon name="ChevronRight" size={14} style={{color:"var(--sf-fg-4)"}}/>
              </button>
            );
          })}
        </div>

        <button className="sf-tap" style={{
          width:"100%",padding:14,borderRadius:16,
          background:"white",border:"1.5px dashed var(--sf-indigo-200)",color:"var(--sf-indigo-600)",
          font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",
        }}>
          <Icon name="Plus" size={14}/> Crear cliente nuevo
        </button>
      </div>
    </SheetShell>
  );
}

// ---------- NotifSheet ----------
function NotifSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <SheetShell open={open} onClose={onClose} title="Notificaciones" subtitle={`${NOTIFICATIONS.length} eventos hoy`}>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {NOTIFICATIONS.map(n => {
          const palette = n.type === "warning" ? "amber" : n.type === "success" ? "emerald" : "blue";
          const icMap   = { warning: "AlertTriangle", success: "CheckCircle2", info: "Bell" };
          return (
            <div key={n.id} className="sf-card-soft" style={{padding:14,display:"flex",gap:12,alignItems:"flex-start"}}>
              <IconChip name={icMap[n.type] || "Bell"} palette={palette} size={36} icSize={16}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{font:"900 12px/1.2 Inter",color:"var(--sf-fg-1)"}}>{n.title}</div>
                  <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)",whiteSpace:"nowrap"}}>{n.time}</span>
                </div>
                <div style={{font:"500 11px/1.4 Inter",color:"var(--sf-fg-3)",marginTop:6}}>{n.message}</div>
              </div>
            </div>
          );
        })}
      </div>
    </SheetShell>
  );
}

// ---------- BranchSwitchSheet ----------
function BranchSwitchSheet({ open, onClose, branch, onSwitch }) {
  if (!open) return null;
  return (
    <SheetShell open={open} onClose={onClose} title="Cambiar sucursal" subtitle="Tus ventas se registrarán aquí">
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {BRANCHES.map(b => {
          const active = b.id === branch.id;
          return (
            <button key={b.id} onClick={() => { onSwitch(b); onClose(); }} className="sf-tap" style={{
              width:"100%",padding:14,borderRadius:16,cursor:"pointer",textAlign:"left",
              background: active ? "#fbfbff" : "white",
              border: `1px solid ${active ? "var(--sf-indigo-200)" : "var(--sf-stroke-1)"}`,
              display:"flex",alignItems:"center",gap:12,
              boxShadow:"0 1px 2px rgba(15,23,42,0.04)",
            }}>
              <IconChip name="Building2" palette={active?"indigoSolid":"slate"} size={42} icSize={18}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{font:"900 13px/1.1 Inter",color:"var(--sf-fg-1)"}}>{b.name}</div>
                <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:5}}>{b.city}</div>
              </div>
              {active && <Pill kind="success">activa</Pill>}
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
}

window.SheetShell = SheetShell;
window.ShiftOpenSheet = ShiftOpenSheet;
window.CustomerSheet = CustomerSheet;
window.NotifSheet = NotifSheet;
window.BranchSwitchSheet = BranchSwitchSheet;
