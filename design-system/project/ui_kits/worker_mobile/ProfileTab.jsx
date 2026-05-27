// ProfileTab — premium identity + performance + payment donut + shift control + history.

function ProfileTab({ shift, onOpenShift, onCloseShift, onLogout }) {
  const commission = Math.round((shift.salesTotal || 0) * 0.025);
  const cashOnHand = (shift.opening || 0) + (shift.byMethod?.efectivo || 0) - (shift.retiros || []).reduce((s,r)=>s+r.amount,0);
  const progress = Math.min(1, (shift.salesTotal || 0) / SALES_TARGET);

  // Payment-method breakdown for donut
  const byMethod = shift.byMethod || {};
  const totalByMethod = (byMethod.efectivo || 0) + (byMethod.tarjeta || 0) + (byMethod.transferencia || 0) + (byMethod.digital || 0);

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:16}}>
      {/* Identity card */}
      <div className="sf-hero-card" style={{padding:"22px 22px 20px",borderRadius:28}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Avatar initial={PROFILE.initial} size={62} palette="glass" ring/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:"900 19px/1.1 Inter",letterSpacing:"-0.02em",color:"white"}}>{PROFILE.name}</div>
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <Pill kind="dark">{PROFILE.roleLabel}</Pill>
              <Pill kind="dark"><Icon name="Building2" size={9}/> {PROFILE.branchLabel.replace("Sucursal ","")}</Pill>
            </div>
            <div style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)",marginTop:8,fontFamily:"ui-monospace,monospace"}}>{PROFILE.email}</div>
          </div>
          <button onClick={onLogout} className="sf-tap" style={{
            width:40,height:40,borderRadius:13,background:"rgba(244,63,94,0.18)",color:"#fda4af",
            border:"1px solid rgba(244,63,94,0.22)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}><Icon name="LogOut" size={15}/></button>
        </div>
      </div>

      {/* Performance card */}
      <div className="sf-card-soft sf-item-in" style={{padding:18,display:"flex",flexDirection:"column",gap:14,animationDelay:"80ms"}}>
        <div className="sf-section-h">
          <div>
            <span className="lbl" style={{fontSize:11,color:"var(--sf-fg-2)"}}>Rendimiento del día</span>
            <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Comisión, meta y avance comercial</div>
          </div>
          <IconChip name="TrendingUp" palette="indigoSolid" size={36} icSize={16}/>
        </div>

        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-4)"}}>Meta de Ventas</span>
            <span style={{font:"900 11px/1 Inter",color:"var(--sf-indigo-600)"}} className="sf-tnum">{CLP(shift.salesTotal || 0)} / {CLP(SALES_TARGET)}</span>
          </div>
          <div style={{height:14,background:"var(--sf-slate-100)",borderRadius:9999,padding:2,border:"1px solid var(--sf-slate-50)",overflow:"hidden"}}>
            <AnimatedBar progress={progress}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <span style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-indigo-500)"}}>Avance comercial</span>
            <span style={{font:"900 9px/1 Inter",color:"var(--sf-indigo-500)"}}>{Math.round(progress*100)}% completado</span>
          </div>
        </div>

        <div style={{
          background:"linear-gradient(140deg,#eef2ff,#fbfbff)",
          border:"1px solid var(--sf-indigo-100)",
          borderRadius:18,padding:14,display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <IconChip name="Coins" palette="indigoSolid" size={44} icSize={20}/>
            <div>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>Comisión acumulada</div>
              <MoneyTicker value={commission} style={{font:"900 22px/1.1 Inter",color:"var(--sf-indigo-950)",letterSpacing:"-0.025em",marginTop:5,display:"block"}}/>
            </div>
          </div>
          <span style={{font:"900 9px/1 Inter",background:"white",border:"1px solid var(--sf-indigo-100)",padding:"6px 10px",borderRadius:10,color:"var(--sf-indigo-600)",boxShadow:"0 1px 2px rgba(15,23,42,0.05)"}}>Tasa 2.5%</span>
        </div>
      </div>

      {/* Payment breakdown donut */}
      {shift.open && totalByMethod > 0 && (
        <div className="sf-card-soft sf-item-in" style={{padding:18,display:"flex",flexDirection:"column",gap:14,animationDelay:"140ms"}}>
          <div className="sf-section-h">
            <div>
              <span className="lbl" style={{fontSize:11,color:"var(--sf-fg-2)"}}>Método de pago</span>
              <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Distribución del turno</div>
            </div>
            <IconChip name="PieChart" palette="indigo" size={32} icSize={14}/>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <PaymentDonut byMethod={byMethod} total={totalByMethod}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
              {[
                { k:"efectivo",      lbl:"Efectivo",      color:"#10b981" },
                { k:"tarjeta",       lbl:"Tarjetas",      color:"#3b82f6" },
                { k:"transferencia", lbl:"Transferencia", color:"#f59e0b" },
                { k:"digital",       lbl:"Virtual",       color:"#6366f1" },
              ].map(m => {
                const v = byMethod[m.k] || 0;
                const pct = totalByMethod ? Math.round(v / totalByMethod * 100) : 0;
                return (
                  <div key={m.k} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:8,height:8,borderRadius:9999,background:m.color,flexShrink:0}}/>
                    <span style={{flex:1,font:"800 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-3)"}}>{m.lbl}</span>
                    <span className="sf-tnum" style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>{CLP(v)}</span>
                    <span style={{font:"900 9px/1 Inter",color:"var(--sf-fg-4)",width:28,textAlign:"right"}} className="sf-tnum">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Shift control */}
      {!shift.open ? (
        <div className="sf-card-soft sf-item-in" style={{padding:24,textAlign:"center",animationDelay:"180ms"}}>
          <div style={{
            width:72,height:72,borderRadius:24,
            background:"linear-gradient(140deg,#fff1f2,#fecdd3)",color:"var(--sf-danger)",
            display:"flex",alignItems:"center",justifyContent:"center",margin:"4px auto 14px",
            boxShadow:"0 8px 18px -6px rgba(244,63,94,0.35), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}>
            <Icon name="Lock" size={28}/>
          </div>
          <div style={{font:"900 14px/1.2 Inter",color:"var(--sf-fg-1)",textTransform:"uppercase",letterSpacing:"0.12em"}}>Caja Cerrada · Sin Turno</div>
          <p style={{font:"600 12px/1.5 Inter",color:"var(--sf-fg-3)",margin:"10px auto 18px",maxWidth:280}}>
            Para empezar a procesar ventas, abre tu turno y declara el saldo de reserva inicial en efectivo.
          </p>
          <button onClick={onOpenShift} className="sf-btn-cta">
            <Icon name="Unlock" size={15}/> Iniciar Turno y Abrir Caja
          </button>
        </div>
      ) : (
        <div className="sf-card-soft sf-item-in" style={{padding:18,display:"flex",flexDirection:"column",gap:14,animationDelay:"180ms"}}>
          <div className="sf-section-h">
            <div>
              <span className="lbl" style={{fontSize:11,color:"var(--sf-fg-2)"}}>Control del turno</span>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                <span style={{width:7,height:7,borderRadius:9999,background:"var(--sf-success)",boxShadow:"0 0 0 3px rgba(5,150,105,0.18)"}}/>
                <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-success)"}}>Turno en curso</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-4)"}}>Abierto</div>
              <div style={{font:"700 11px/1 ui-monospace,monospace",color:"var(--sf-fg-3)",marginTop:5}}>{shift.openedAt || "—"}</div>
            </div>
          </div>

          {/* Estimated cash on hand */}
          <div style={{
            background:"linear-gradient(140deg,#ecfdf5,#d1fae5)",
            border:"1px solid #a7f3d0",borderRadius:18,padding:14,
            display:"flex",justifyContent:"space-between",alignItems:"center",
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.6)",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <IconChip name="Banknote" palette="emeraldSolid" size={42} icSize={18}/>
              <div>
                <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"#065f46"}}>Efectivo estimado en caja</div>
                <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:4}}>Inicial + Ventas Efec. − Retiros</div>
              </div>
            </div>
            <MoneyTicker value={cashOnHand} style={{font:"900 20px/1 Inter",color:"#065f46",letterSpacing:"-0.025em"}}/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button className="sf-tap" style={{
              padding:"14px 12px",borderRadius:14,background:"white",border:"1px solid var(--sf-stroke-1)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",
              font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-2)",
              boxShadow:"0 1px 2px rgba(15,23,42,0.04)",
            }}>
              <Icon name="Minus" size={13} style={{color:"var(--sf-warning)"}}/> Retiro
            </button>
            <button onClick={onCloseShift} className="sf-tap" style={{
              padding:"14px 12px",borderRadius:14,
              background:"linear-gradient(140deg,#0f172a,#1e293b)",border:"none",color:"white",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",
              font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
              boxShadow:"0 10px 20px -8px rgba(15,23,42,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
            }}>
              <Icon name="Lock" size={13}/> Cerrar Turno
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="sf-item-in" style={{animationDelay:"240ms"}}>
        <div className="sf-section-h" style={{marginBottom:10}}>
          <span className="lbl">Historial de ventas · hoy</span>
          <Pill kind="accent">{TRANSACTIONS.length} ventas</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TRANSACTIONS.map((t,i) => <TxnRow key={t.id} txn={t} style={{animationDelay:`${280 + i*30}ms`}}/>)}
        </div>
      </div>
    </div>
  );
}

function AnimatedBar({ progress }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const id = setTimeout(() => setW(progress * 100), 20);
    return () => clearTimeout(id);
  }, [progress]);
  return (
    <div style={{
      height:"100%",width:`${w}%`,
      background:"linear-gradient(to right,#6366f1,#4f46e5)",
      borderRadius:9999,transition:"width 1.2s var(--sf-spring)",
      boxShadow:"0 2px 6px -2px rgba(79,70,229,0.45)",
    }}/>
  );
}

// Donut chart for payment method breakdown
function PaymentDonut({ byMethod, total }) {
  const size = 96, stroke = 14, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segments = [
    { v: byMethod.efectivo || 0,      color:"#10b981" },
    { v: byMethod.tarjeta || 0,       color:"#3b82f6" },
    { v: byMethod.transferencia || 0, color:"#f59e0b" },
    { v: byMethod.digital || 0,       color:"#6366f1" },
  ];
  const [animate, setAnimate] = React.useState(false);
  React.useEffect(() => { const id = setTimeout(() => setAnimate(true), 30); return () => clearTimeout(id); }, []);
  let offset = 0;
  return (
    <div style={{position:"relative",flexShrink:0,width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sf-slate-100)" strokeWidth={stroke}/>
        {segments.map((seg, i) => {
          const pct = total ? seg.v / total : 0;
          const len = c * pct;
          const dashArray = `${animate ? len : 0} ${c}`;
          const dashOffset = -offset;
          offset += animate ? len : 0;
          return (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={dashArray} strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              style={{transition: `stroke-dasharray 1.2s ${i*150}ms var(--sf-spring)`}}
            />
          );
        })}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>Total</div>
        <div style={{font:"900 13px/1 Inter",color:"var(--sf-fg-1)",marginTop:5,letterSpacing:"-0.02em"}} className="sf-tnum">{CLP(total).replace(/\.000$/,"K")}</div>
      </div>
    </div>
  );
}

window.ProfileTab = ProfileTab;
window.PaymentDonut = PaymentDonut;
