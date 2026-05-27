// HeroBalance — premium banking-app "balance" card with sparkline + ring + commission

function HeroBalance({ salesTotal, salesCount, target, commission, registerOpen, onOpenShift, onTapDetail }) {
  const progress = Math.min(1, salesTotal / target);
  const pct = Math.round(progress * 100);
  const peak = HOURLY_SALES.reduce((m,d) => d.v > m.v ? d : m, HOURLY_SALES[0]);

  return (
    <div className="sf-hero-card sf-item-in">
      {/* Top row — shift status + commission chip */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{
              display:"inline-block",width:8,height:8,borderRadius:9999,
              background: registerOpen ? "#34d399" : "#fb7185",
              boxShadow: registerOpen ? "0 0 0 4px rgba(52,211,153,0.20)" : "0 0 0 4px rgba(251,113,133,0.18)",
              animation: registerOpen ? "sf-pulse 1.8s ease-in-out infinite" : "none",
            }}/>
            <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.78)"}}>
              {registerOpen ? "Turno en curso" : "Caja cerrada"}
            </span>
            <span style={{font:"700 10px/1 Inter",color:"rgba(255,255,255,0.45)",marginLeft:4}}>· {new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          <div style={{font:"900 10px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)",marginTop:12}}>
            Ventas de hoy
          </div>
        </div>
        <button onClick={onTapDetail} className="sf-glass-strong sf-tap" style={{
          borderRadius:14,padding:"7px 10px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",border:"none",
        }}>
          <div style={{
            width:26,height:26,borderRadius:9,
            background:"linear-gradient(140deg,rgba(252,211,77,0.35),rgba(252,211,77,0.10))",
            display:"flex",alignItems:"center",justifyContent:"center",color:"#fde68a",
          }}>
            <Icon name="Coins" size={13}/>
          </div>
          <div style={{textAlign:"right",lineHeight:1}}>
            <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.60)"}}>Comisión</div>
            <div style={{font:"900 13px/1 Inter",color:"white",marginTop:4}} className="sf-tnum">{CLP(commission)}</div>
          </div>
        </button>
      </div>

      {/* Big amount + progress ring */}
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginTop:6}}>
        <div style={{flex:1,minWidth:0}}>
          <MoneyTicker value={salesTotal} animate className="sf-tnum"
            style={{font:"900 42px/1 Inter",color:"white",letterSpacing:"-0.035em",display:"block"}} />
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Pill kind="dark">{salesCount} ventas</Pill>
            <span style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)"}}>· meta {CLP(target)}</span>
          </div>
        </div>
        <ProgressRing size={78} stroke={6} progress={progress}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1}}>
            <span style={{font:"900 16px/1 Inter",color:"white",letterSpacing:"-0.02em"}} className="sf-tnum">{pct}%</span>
            <span style={{font:"900 7px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.6)",marginTop:4}}>Meta</span>
          </div>
        </ProgressRing>
      </div>

      {/* Inline sparkline by hour */}
      <div style={{marginTop:18,position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.55)"}}>Por hora</span>
          <span style={{font:"700 10px/1 Inter",color:"rgba(255,255,255,0.55)"}}>Peak <span style={{color:"white",fontWeight:900}}>{peak.h}:00</span> · {CLP(peak.v)}</span>
        </div>
        <Sparkline data={HOURLY_SALES} height={36} gap={3} color="white"/>
      </div>

      {/* CTA shift bar */}
      {!registerOpen && (
        <button onClick={onOpenShift} className="sf-tap" style={{
          marginTop:18,width:"100%",background:"white",color:"var(--sf-indigo-700)",
          border:"none",borderRadius:16,padding:"13px 16px",
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
          font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",cursor:"pointer",
          boxShadow:"0 8px 18px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}>
          <span style={{display:"flex",alignItems:"center",gap:8}}><Icon name="Unlock" size={14}/> Abrir caja para empezar</span>
          <Icon name="ChevronRight" size={14}/>
        </button>
      )}
    </div>
  );
}

window.HeroBalance = HeroBalance;
