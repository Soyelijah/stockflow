// HomeTab — hero balance + quick actions + stats grid + week chart + recent feed.

function HomeTab({ shift, onOpenShift, onCloseShift, onScan, onCustomer, onKardex, onJumpTo }) {
  const salesTotal = shift.salesTotal || 0;
  const salesCount = shift.salesCount || 0;
  const commission = Math.round(salesTotal * 0.025);
  const ticketAvg = salesCount > 0 ? Math.round(salesTotal / salesCount) : 0;

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:18}}>
      <HeroBalance
        salesTotal={salesTotal}
        salesCount={salesCount}
        target={SALES_TARGET}
        commission={commission}
        registerOpen={shift.open}
        onOpenShift={onOpenShift}
        onTapDetail={() => onJumpTo("profile")}
      />

      <QuickActions
        onScan={onScan}
        onClose={onCloseShift}
        onCustomer={onCustomer}
        onKardex={onKardex}
      />

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <StatTile
          label="Ticket promedio"
          value={CLP(ticketAvg)}
          delta="+12% vs ayer" deltaPositive={true}
          sparkData={HOURLY_SALES.slice(-8)}
          icon="Receipt" palette="indigo"
        />
        <StatTile
          label="Clientes únicos"
          value={"8"}
          delta="+2 hoy" deltaPositive={true}
          sparkData={[{v:1},{v:2},{v:1},{v:3},{v:2},{v:4},{v:3},{v:5}]}
          icon="Users" palette="purple"
        />
      </div>

      {/* Week mini chart */}
      <div className="sf-card-soft sf-item-in" style={{padding:18,animationDelay:"160ms"}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",letterSpacing:"-0.005em",color:"var(--sf-fg-1)"}}>Esta semana</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Ventas diarias · Lun – Dom</div>
          </div>
          <Pill kind="success"><Icon name="TrendingUp" size={9} strokeWidth={3}/>+18%</Pill>
        </div>
        <WeekChart data={WEEK_SALES}/>
      </div>

      {/* Shift mini summary card */}
      <div className="sf-card-soft sf-item-in" style={{padding:18,animationDelay:"200ms"}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <span className="lbl">Arqueo del turno</span>
          <button className="more" onClick={() => onJumpTo("profile")}>Detalle <Icon name="ChevronRight" size={11}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <MiniStat label="Fondo inicial" value={CLP(shift.opening)} />
          <MiniStat label="Efectivo en caja" value={CLP(shift.opening + (shift.byMethod.efectivo || 0))} accent="emerald" />
          <MiniStat label="Tarjetas" value={CLP(shift.byMethod.tarjeta || 0)} accent="blue" />
          <MiniStat label="Virtual + Transf." value={CLP((shift.byMethod.transferencia || 0) + (shift.byMethod.digital || 0))} accent="indigo" />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="sf-item-in" style={{animationDelay:"260ms"}}>
        <div className="sf-section-h" style={{marginBottom:10}}>
          <span className="lbl">Movimientos recientes</span>
          <button className="more" onClick={() => onJumpTo("profile")}>Historial <Icon name="ChevronRight" size={11}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TRANSACTIONS.slice(0,5).map((t,i) => (
            <TxnRow key={t.id} txn={t} style={{animationDelay:`${300 + i*40}ms`}} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  const fg = accent === "emerald" ? "var(--sf-success)"
    : accent === "blue" ? "var(--sf-info)"
    : accent === "indigo" ? "var(--sf-indigo-600)"
    : "var(--sf-fg-1)";
  return (
    <div style={{
      background:"linear-gradient(180deg,var(--sf-slate-50),white)",
      border:"1px solid var(--sf-stroke-1)",
      borderRadius:14,padding:"11px 12px",
    }}>
      <div style={{font:"900 8px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>{label}</div>
      <div style={{font:"900 15px/1 Inter",color:fg,marginTop:7,letterSpacing:"-0.015em"}} className="sf-tnum">{value}</div>
    </div>
  );
}

function WeekChart({ data }) {
  const max = Math.max(...data.map(d => d.v));
  const today = data.length - 1;
  return (
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",height:96,gap:8}}>
      {data.map((d, i) => {
        const h = (d.v / max) * 80;
        const isToday = i === today;
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <div className="sf-bar" style={{
              width:"100%",height:h,
              background: isToday
                ? "linear-gradient(180deg,#6366f1,#4f46e5)"
                : "linear-gradient(180deg,#eef2ff,#e0e7ff)",
              border: isToday ? "none" : "1px solid #e0e7ff",
              borderRadius:"6px 6px 2px 2px",
              animationDelay:`${i * 50}ms`,
              boxShadow: isToday ? "0 8px 16px -6px rgba(79,70,229,0.55)" : "none",
              position:"relative",
            }}>
              {isToday && (
                <div style={{position:"absolute",top:-22,left:"50%",transform:"translateX(-50%)",
                  font:"900 9px/1 Inter",color:"var(--sf-indigo-600)",whiteSpace:"nowrap",
                  background:"white",border:"1px solid var(--sf-indigo-100)",padding:"3px 6px",borderRadius:6,
                  boxShadow:"0 2px 6px -2px rgba(79,70,229,0.30)",
                }} className="sf-tnum">{CLP(d.v).replace(/\.000$/,"K")}</div>
              )}
            </div>
            <span style={{font:`900 9px/1 Inter`,color: isToday ? "var(--sf-indigo-600)" : "var(--sf-fg-4)",textTransform:"uppercase",letterSpacing:"0.14em"}}>{d.d}</span>
          </div>
        );
      })}
    </div>
  );
}

function TxnRow({ txn, style }) {
  const methodMap = {
    efectivo:      { ic: "Banknote",    palette: "emerald" },
    tarjeta:       { ic: "CreditCard",  palette: "blue" },
    transferencia: { ic: "RefreshCw",   palette: "amber" },
    digital:       { ic: "Smartphone",  palette: "indigo" },
  };
  const m = methodMap[txn.method] || methodMap.efectivo;
  return (
    <div className="sf-row sf-press sf-item-in" style={style}>
      <IconChip name={m.ic} palette={m.palette} size={42} icSize={18} />
      <div style={{flex:1,minWidth:0}}>
        <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{txn.customer}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
          <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-fg-4)"}}>{txn.id.slice(-8)}</span>
          <span style={{width:3,height:3,borderRadius:9999,background:"var(--sf-slate-300)"}}/>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{txn.at}</span>
          <Pill kind={txn.doc === "factura" ? "accent" : "neutral"} style={{padding:"1px 6px",fontSize:8}}>{txn.doc}</Pill>
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div className="sf-tnum" style={{font:"900 14px/1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.015em"}}>{CLP(txn.amount)}</div>
        <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginTop:5}}>{txn.method === "transferencia" ? "TRANSF" : txn.method}</div>
      </div>
      <Icon name="ChevronRight" size={14} style={{color:"var(--sf-slate-300)"}}/>
    </div>
  );
}

window.HomeTab = HomeTab;
window.TxnRow = TxnRow;
window.WeekChart = WeekChart;
