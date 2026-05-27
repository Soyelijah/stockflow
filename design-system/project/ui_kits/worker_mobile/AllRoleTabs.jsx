// AllRoleTabs.jsx — consolidated role tabs + detail sheets

// =================== JefeTabs.jsx ===================
// JefeTabs.jsx — Jefe de Local (Store Manager) screens.
// Home: branch overview + pending approvals + top sellers
// Team: list of sellers with status, performance, communication
// Reports: KPIs, charts, comparison vs target

function JefeHomeTab({ shift, branch, onJumpTo, onOpenApproval }) {
  const branchSales = TEAM_MEMBERS.reduce((s, m) => s + m.sales, 0);
  const branchCount = TEAM_MEMBERS.reduce((s, m) => s + m.count, 0);
  const branchTarget = TEAM_MEMBERS.reduce((s, m) => s + m.target, 0);
  const topSeller = [...TEAM_MEMBERS].sort((a, b) => b.sales - a.sales)[0];

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:18}}>
      {/* Branch-level hero */}
      <BranchHeroCard
        branch={branch}
        sales={branchSales} count={branchCount} target={branchTarget}
        topSeller={topSeller}
        sellersActive={TEAM_MEMBERS.filter(m => m.status !== "offline").length}
      />

      {/* Quick actions: jefe focus */}
      <div style={{display:"flex",gap:8}}>
        <QuickActionBtn ic="CheckCircle2" label="Aprobaciones" badge={PENDING_APPROVALS.length} palette="amberSolid" onClick={() => onJumpTo("team")}/>
        <QuickActionBtn ic="Users"        label="Equipo"      palette="indigoSolid" onClick={() => onJumpTo("team")}/>
        <QuickActionBtn ic="Activity"     label="Reportes"    palette="emeraldSolid" onClick={() => onJumpTo("reports")}/>
        <QuickActionBtn ic="Lock"         label="Cierre"      palette="roseSolid" onClick={() => alert("Cierre del día")}/>
      </div>

      {/* Pending approvals */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Aprobaciones pendientes</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Requieren tu sign‑off antes de cerrar</div>
          </div>
          <Pill kind="warning" pulse>{PENDING_APPROVALS.length} pendientes</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {PENDING_APPROVALS.map(a => <ApprovalRow key={a.id} approval={a} onTap={onOpenApproval}/>)}
        </div>
      </div>

      {/* Top sellers */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Ranking del día</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Por monto vendido</div>
          </div>
          <button className="more" onClick={() => onJumpTo("team")}>Ver equipo <Icon name="ChevronRight" size={11}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[...TEAM_MEMBERS].sort((a,b) => b.sales - a.sales).slice(0,3).map((m, i) => (
            <TeamRow key={m.id} member={m} rank={i+1} compact/>
          ))}
        </div>
      </div>

      {/* Stock alerts */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:12}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Alertas de stock</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>En tu sucursal</div>
          </div>
          <Pill kind="danger">{STOCK_ALERTS.filter(s => s.branch === "Centro").length} críticos</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {STOCK_ALERTS.filter(s => s.branch === "Centro").map(s => <StockAlertRow key={s.id} alert={s}/>)}
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const [filter, setFilter] = React.useState("all"); // all | selling | break | offline
  const filtered = filter === "all" ? TEAM_MEMBERS : TEAM_MEMBERS.filter(m => m.status === filter);
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Mi equipo</h2>
        <Pill kind="accent">{TEAM_MEMBERS.filter(m => m.status === "selling").length} activos</Pill>
      </div>

      {/* Status filter */}
      <div className="sf-segmented" style={{width:"100%"}}>
        {[
          { id:"all",     label:"Todos" },
          { id:"selling", label:"Vendiendo" },
          { id:"break",   label:"En pausa" },
          { id:"offline", label:"Offline" },
        ].map(f => (
          <button key={f.id} className={filter === f.id ? "active" : ""} style={{flex:1}} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {/* Aggregate strip */}
      <div className="sf-card-soft" style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <MiniStat label="Total ventas hoy" value={CLP(TEAM_MEMBERS.reduce((s,m)=>s+m.sales,0))} accent="indigo"/>
        <MiniStat label="Total tickets"    value={String(TEAM_MEMBERS.reduce((s,m)=>s+m.count,0))} accent="emerald"/>
        <MiniStat label="Avg ticket"       value={CLP(Math.round(TEAM_MEMBERS.reduce((s,m)=>s+m.sales,0) / Math.max(1, TEAM_MEMBERS.reduce((s,m)=>s+m.count,0))))} accent="blue"/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map((m, i) => <TeamRow key={m.id} member={m} rank={i+1}/>)}
      </div>
    </div>
  );
}

function ReportsTab({ scope = "branch" }) {
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Reportes</h2>
        <Pill kind="accent">Hoy · {new Date().toLocaleDateString("es-CL")}</Pill>
      </div>

      <div className="sf-segmented" style={{width:"100%"}}>
        <button className="active" style={{flex:1}}>Día</button>
        <button style={{flex:1}}>Semana</button>
        <button style={{flex:1}}>Mes</button>
      </div>

      {/* KPI grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <StatTile label="Ingresos totales"   value={CLP(625480)} delta="+18% vs ayer" deltaPositive sparkData={HOURLY_SALES.slice(-8)} icon="TrendingUp" palette="indigo"/>
        <StatTile label="Tickets emitidos"   value="33"           delta="+5 vs ayer"   deltaPositive sparkData={[{v:2},{v:4},{v:3},{v:6},{v:5},{v:7},{v:6},{v:8}]} icon="Receipt" palette="emerald"/>
        <StatTile label="Ticket promedio"    value={CLP(18954)}   delta="+12%"         deltaPositive sparkData={[{v:15},{v:17},{v:16},{v:19},{v:18},{v:20},{v:19},{v:21}]} icon="Coins"   palette="amber"/>
        <StatTile label="Devoluciones"       value="2"             delta="-1 vs ayer"   deltaPositive sparkData={[{v:3},{v:4},{v:5},{v:3},{v:2},{v:4},{v:3},{v:2}]} icon="RefreshCw" palette="rose"/>
      </div>

      {/* Week chart */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Ventas semanales</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Lun – Dom · {scope === "branch" ? "Sucursal Centro" : "Todas las sucursales"}</div>
          </div>
          <Pill kind="success">+18%</Pill>
        </div>
        <WeekChart data={WEEK_SALES}/>
      </div>

      {/* By payment method */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Método de pago</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Distribución del día</div>
          </div>
          <IconChip name="PieChart" palette="indigo" size={32} icSize={14}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <PaymentDonut byMethod={{efectivo:48500,tarjeta:312300,transferencia:128240,digital:136440}} total={625480}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
            {[
              { k:"Tarjetas",       v:312300, color:"#3b82f6", pct:50 },
              { k:"Virtual",        v:136440, color:"#6366f1", pct:22 },
              { k:"Transferencia",  v:128240, color:"#f59e0b", pct:20 },
              { k:"Efectivo",       v: 48500, color:"#10b981", pct: 8 },
            ].map(r => (
              <div key={r.k} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:8,height:8,borderRadius:9999,background:r.color,flexShrink:0}}/>
                <span style={{flex:1,font:"800 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-3)"}}>{r.k}</span>
                <span className="sf-tnum" style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>{CLP(r.v)}</span>
                <span style={{font:"900 9px/1 Inter",color:"var(--sf-fg-4)",width:28,textAlign:"right"}} className="sf-tnum">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Reusable pieces =====

function BranchHeroCard({ branch, sales, count, target, topSeller, sellersActive }) {
  const progress = Math.min(1, sales / target);
  return (
    <div className="sf-hero-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="Building2" size={14} style={{color:"#a5b4fc"}}/>
            <span style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.78)"}}>{branch.name}</span>
          </div>
          <div style={{font:"900 11px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)",marginTop:14}}>
            Ventas de la sucursal · hoy
          </div>
        </div>
        <div className="sf-glass-strong" style={{borderRadius:14,padding:"6px 12px",display:"flex",alignItems:"center",gap:7}}>
          <span style={{width:7,height:7,borderRadius:9999,background:"#34d399",boxShadow:"0 0 0 4px rgba(52,211,153,0.20)"}}/>
          <span style={{font:"900 10px/1 Inter",color:"white"}}>{sellersActive} vend. activos</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginTop:8}}>
        <div style={{flex:1,minWidth:0}}>
          <MoneyTicker value={sales} animate style={{font:"900 38px/1 Inter",color:"white",letterSpacing:"-0.03em",display:"block"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Pill kind="dark">{count} tickets</Pill>
            <span style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)"}}>de {CLP(target)} meta</span>
          </div>
        </div>
        <ProgressRing size={76} stroke={6} progress={progress}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <span style={{font:"900 16px/1 Inter",color:"white",letterSpacing:"-0.02em"}}>{Math.round(progress*100)}%</span>
            <span style={{font:"900 7px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.6)",marginTop:4}}>Meta</span>
          </div>
        </ProgressRing>
      </div>
      <div style={{marginTop:18,padding:14,borderRadius:16,
        background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",
        display:"flex",alignItems:"center",gap:12}}>
        <div style={{
          width:36,height:36,borderRadius:11,background:"linear-gradient(140deg,#fbbf24,#f59e0b)",
          display:"flex",alignItems:"center",justifyContent:"center",color:"white",
          boxShadow:"0 6px 12px -4px rgba(245,158,11,0.55)",
        }}><Icon name="Star" size={16} fill="currentColor" strokeWidth={0}/></div>
        <div style={{flex:1}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.65)"}}>Top vendedor</div>
          <div style={{font:"900 13px/1.2 Inter",color:"white",marginTop:4}}>{topSeller.name} · {CLP(topSeller.sales)}</div>
        </div>
        <Icon name="ChevronRight" size={14} style={{color:"rgba(255,255,255,0.6)"}}/>
      </div>
    </div>
  );
}

function QuickActionBtn({ ic, label, badge, palette = "indigoSolid", onClick }) {
  return (
    <button className="sf-qa" onClick={onClick}>
      <div className="ic-wrap" style={{position:"relative"}}>
        <IconChip name={ic} palette={palette} size={42} icSize={18}/>
        {badge > 0 && (
          <span style={{
            position:"absolute",top:-4,right:-6,minWidth:18,height:18,padding:"0 5px",
            background:"linear-gradient(140deg,#e11d48,#f43f5e)",color:"white",borderRadius:9999,
            font:"900 9px/18px Inter",textAlign:"center",border:"2px solid white",
            boxShadow:"0 2px 6px -2px rgba(244,63,94,0.55)",
          }}>{badge}</span>
        )}
      </div>
      <span className="label">{label}</span>
    </button>
  );
}

function ApprovalRow({ approval, onTap }) {
  const palette = approval.risk === "high" ? "roseSolid" : approval.risk === "med" ? "amberSolid" : "blueSolid";
  const ic = approval.type === "refund" ? "RefreshCw" : approval.type === "discount" ? "Tag" : "Lock";
  return (
    <div className="sf-row sf-press" onClick={() => onTap?.(approval)} style={{cursor:"pointer"}}>
      <IconChip name={ic} palette={palette} size={42} icSize={18}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)"}}>{approval.title}</div>
          {approval.risk === "high" && <Pill kind="danger">alto</Pill>}
        </div>
        <div style={{font:"700 11px/1.3 Inter",color:"var(--sf-fg-3)",marginTop:4}}>{approval.detail}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{approval.seller}</span>
          <span style={{width:3,height:3,borderRadius:9999,background:"var(--sf-slate-300)"}}/>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{approval.time}</span>
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <button className="sf-tap" style={{width:36,height:36,borderRadius:11,background:"var(--sf-slate-100)",border:"none",color:"var(--sf-fg-3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="X" size={14}/></button>
        <button className="sf-tap" style={{width:36,height:36,borderRadius:11,background:"linear-gradient(140deg,#10b981,#059669)",border:"none",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 14px -4px rgba(16,185,129,0.55)"}}><Icon name="Check" size={14} strokeWidth={3}/></button>
      </div>
    </div>
  );
}

function TeamRow({ member, rank, compact }) {
  const progress = Math.min(1, member.sales / member.target);
  const statusColor = member.status === "selling" ? "#34d399" : member.status === "break" ? "#fbbf24" : "#94a3b8";
  return (
    <div className="sf-row sf-press">
      <div style={{position:"relative"}}>
        <Avatar initial={member.initial} size={44} palette="indigoSolid"/>
        <div style={{
          position:"absolute",bottom:-2,right:-2,width:13,height:13,borderRadius:9999,
          background:statusColor,border:"2.5px solid white",
        }}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {rank && <span style={{font:"900 9px/1 Inter",color:rank===1?"#f59e0b":"var(--sf-fg-4)",background:rank===1?"#fffbeb":"var(--sf-slate-100)",padding:"3px 6px",borderRadius:6,letterSpacing:"-0.01em"}}>#{rank}</span>}
          <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{member.role}</span>
          <span style={{width:3,height:3,borderRadius:9999,background:"var(--sf-slate-300)"}}/>
          <span style={{font:"700 10px/1 Inter",color:statusColor,textTransform:"uppercase",letterSpacing:"0.10em"}}>
            {member.status === "selling" ? "vendiendo" : member.status === "break" ? "en pausa" : "offline"}
          </span>
        </div>
        {!compact && (
          <div style={{marginTop:8}}>
            <div style={{height:6,background:"var(--sf-slate-100)",borderRadius:9999,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progress*100}%`,background:"linear-gradient(to right,#6366f1,#4f46e5)",borderRadius:9999,transition:"width 900ms var(--sf-spring)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{font:"700 9px/1 Inter",color:"var(--sf-fg-4)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{member.count} tickets · avg {CLP(member.avg)}</span>
              <span style={{font:"900 10px/1 Inter",color:"var(--sf-indigo-600)"}}>{Math.round(progress*100)}%</span>
            </div>
          </div>
        )}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div className="sf-tnum" style={{font:"900 14px/1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.015em"}}>{CLP(member.sales)}</div>
        <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginTop:5}}>vendido</div>
      </div>
    </div>
  );
}

function StockAlertRow({ alert }) {
  const palette = alert.level === "out" ? "roseSolid" : alert.level === "critical" ? "amberSolid" : "amber";
  const label = alert.level === "out" ? "Agotado" : alert.level === "critical" ? "Crítico" : "Bajo";
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 4px",borderBottom:"1px solid var(--sf-stroke-1)"}}>
      <IconChip name="Package" palette={palette} size={34} icSize={14}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{font:"800 12px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{alert.product}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
          <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-fg-4)"}}>{alert.sku}</span>
          <span style={{width:3,height:3,borderRadius:9999,background:"var(--sf-slate-300)"}}/>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>stock {alert.stock} · reorden {alert.reorderAt}</span>
        </div>
      </div>
      <Pill kind={alert.level === "out" ? "danger" : "warning"}>{label}</Pill>
    </div>
  );
}

window.JefeHomeTab = JefeHomeTab;
window.TeamTab = TeamTab;
window.ReportsTab = ReportsTab;
window.BranchHeroCard = BranchHeroCard;
window.QuickActionBtn = QuickActionBtn;
window.TeamRow = TeamRow;
window.StockAlertRow = StockAlertRow;
window.ApprovalRow = ApprovalRow;


// =================== LogisticsTabs.jsx ===================
// LogisticsTabs.jsx — Operador Logístico screens.
// Home: today's deliveries + pending transfers + stock alerts
// Transfers: stock transfers between branches with status tracking
// Kardex: movement ledger

function LogisticsHomeTab({ branch, onJumpTo, onOpenDelivery }) {
  const pendingDeliv = DELIVERIES.filter(d => d.status === "pending").length;
  const inTransit    = DELIVERIES.filter(d => d.status === "intransit").length;
  const delivered    = DELIVERIES.filter(d => d.status === "delivered").length;
  const pendingTransfers = TRANSFERS.filter(t => t.status === "pending").length;

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:18}}>
      {/* Hero — today's route summary (amber tint instead of indigo) */}
      <LogisticsHero
        pendingDeliv={pendingDeliv}
        inTransit={inTransit}
        delivered={delivered}
        total={DELIVERIES.length}
      />

      {/* Quick actions */}
      <div style={{display:"flex",gap:8}}>
        <QuickActionBtn ic="Truck"     label="Entregas"   badge={pendingDeliv} palette="amberSolid"   onClick={() => onJumpTo("home")}/>
        <QuickActionBtn ic="RefreshCw" label="Traslados"  badge={pendingTransfers} palette="indigoSolid" onClick={() => onJumpTo("transfers")}/>
        <QuickActionBtn ic="Package"   label="Recepción"  palette="emeraldSolid" onClick={() => onJumpTo("kardex")}/>
        <QuickActionBtn ic="Camera"    label="Escanear"   palette="purpleSolid"  onClick={() => alert("Lector QR · simulado")}/>
      </div>

      {/* Today deliveries */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:12}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Entregas de hoy</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>{pendingDeliv} pendientes · {inTransit} en ruta · {delivered} entregadas</div>
          </div>
          <Pill kind="warning" pulse>{pendingDeliv + inTransit} activas</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {DELIVERIES.slice(0,4).map(d => <DeliveryRow key={d.id} delivery={d} onTap={onOpenDelivery}/>)}
        </div>
      </div>

      {/* Pending transfers */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:12}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Traslados pendientes</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Entre sucursales</div>
          </div>
          <button className="more" onClick={() => onJumpTo("transfers")}>Ver todos <Icon name="ChevronRight" size={11}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TRANSFERS.filter(t => t.status !== "received").map(t => <TransferRow key={t.id} transfer={t} compact/>)}
        </div>
      </div>

      {/* Critical stock */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:12}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Stock crítico · todas las sucursales</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Requieren reabastecimiento</div>
          </div>
          <Pill kind="danger">{STOCK_ALERTS.length} SKUs</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {STOCK_ALERTS.map(s => <StockAlertRow key={s.id} alert={s}/>)}
        </div>
        <button className="sf-tap" style={{
          marginTop:14,width:"100%",height:46,borderRadius:14,
          background:"linear-gradient(140deg,#4f46e5,#6366f1)",color:"white",border:"none",cursor:"pointer",
          font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          boxShadow:"0 10px 22px -6px rgba(79,70,229,0.55)",
        }}><Icon name="Plus" size={14} strokeWidth={2.8}/>Generar orden de reposición</button>
      </div>
    </div>
  );
}

function TransfersTab() {
  const [filter, setFilter] = React.useState("all");
  const filtered = filter === "all" ? TRANSFERS : TRANSFERS.filter(t => t.status === filter);
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Traslados</h2>
        <Pill kind="accent">{TRANSFERS.filter(t => t.status !== "received").length} activos</Pill>
      </div>

      <div className="sf-segmented" style={{width:"100%"}}>
        {[
          { id:"all",       label:"Todos" },
          { id:"pending",   label:"Pendiente" },
          { id:"intransit", label:"En ruta" },
          { id:"received",  label:"Recibido" },
        ].map(f => (
          <button key={f.id} className={filter === f.id ? "active" : ""} style={{flex:1}} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {/* Aggregate strip */}
      <div className="sf-card-soft" style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <MiniStat label="Pendientes"  value={String(TRANSFERS.filter(t=>t.status==="pending").length)}   accent="indigo"/>
        <MiniStat label="En ruta"     value={String(TRANSFERS.filter(t=>t.status==="intransit").length)} accent="amber"/>
        <MiniStat label="Hoy total"   value={String(TRANSFERS.length)}                                    accent="emerald"/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(t => <TransferRow key={t.id} transfer={t}/>)}
      </div>

      <button className="sf-btn-cta" style={{marginTop:6}}>
        <Icon name="Plus" size={14} strokeWidth={2.8}/> Crear nuevo traslado
      </button>
    </div>
  );
}

function KardexTab() {
  const [filter, setFilter] = React.useState("all");
  const filtered = filter === "all" ? KARDEX_MOVES : KARDEX_MOVES.filter(k => k.type === filter);
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Kardex</h2>
        <Pill kind="accent">Sucursal Centro</Pill>
      </div>

      {/* Type filter scroll */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2,margin:"0 -16px",padding:"0 16px 4px"}} className="sf-no-scrollbar">
        {[
          { id:"all",      label:"Todos",        ic:null },
          { id:"sale",     label:"Ventas",       ic:"ShoppingCart" },
          { id:"transfer", label:"Traslados",    ic:"RefreshCw" },
          { id:"receive",  label:"Recepciones",  ic:"Package" },
          { id:"adjust",   label:"Ajustes",      ic:"Filter" },
          { id:"return",   label:"Devoluciones", ic:"RefreshCw" },
        ].map(f => {
          const active = f.id === filter;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className="sf-tap" style={{
              padding:"9px 12px",borderRadius:9999,flexShrink:0,
              font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.1em",
              background: active ? "var(--sf-slate-900)" : "white",
              color: active ? "white" : "var(--sf-fg-3)",
              border: `1px solid ${active ? "var(--sf-slate-900)" : "var(--sf-stroke-1)"}`,
              boxShadow: active ? "0 4px 10px -4px rgba(15,23,42,0.4)" : "0 1px 2px rgba(15,23,42,0.04)",
              cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
            }}>
              {f.ic && <Icon name={f.ic} size={11} strokeWidth={2.5}/>}
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(k => <KardexRow key={k.id} move={k}/>)}
      </div>
    </div>
  );
}

// ===== Logistics-specific components =====

function LogisticsHero({ pendingDeliv, inTransit, delivered, total }) {
  const progress = total > 0 ? delivered / total : 0;
  return (
    <div className="sf-hero-card" style={{
      background:
        "radial-gradient(120% 80% at 0% 0%, #818cf8 0%, transparent 50%)," +
        "radial-gradient(120% 80% at 100% 0%, #4f46e5 0%, transparent 55%)," +
        "linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="Truck" size={14} style={{color:"#a5b4fc"}}/>
            <span style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.78)"}}>Ruta del día</span>
          </div>
          <div style={{font:"900 11px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)",marginTop:14}}>
            Entregas asignadas
          </div>
        </div>
        <div className="sf-glass-strong" style={{borderRadius:14,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
          <Icon name="Activity" size={12} style={{color:"#fbbf24"}}/>
          <span style={{font:"900 10px/1 Inter",color:"white"}}>ETA total 2h 34m</span>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginTop:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{font:"900 56px/1 Inter",color:"white",letterSpacing:"-0.04em"}} className="sf-tnum">{delivered}</span>
            <span style={{font:"900 24px/1 Inter",color:"rgba(255,255,255,0.40)",letterSpacing:"-0.025em"}} className="sf-tnum">/{total}</span>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Pill kind="dark">{pendingDeliv} pendientes</Pill>
            <Pill kind="dark">{inTransit} en ruta</Pill>
          </div>
        </div>
        <ProgressRing size={76} stroke={6} progress={progress} fg="#34d399">
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <Icon name="Check" size={20} style={{color:"#34d399"}} strokeWidth={3}/>
            <span style={{font:"900 7px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.6)",marginTop:4}}>Done</span>
          </div>
        </ProgressRing>
      </div>

      {/* Mini progress bar timeline */}
      <div style={{marginTop:18}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:delivered,height:6,background:"linear-gradient(to right,#34d399,#10b981)",borderRadius:"9999px 0 0 9999px",minWidth: delivered ? 30 : 0}}/>
          <div style={{flex:inTransit,height:6,background:"linear-gradient(to right,#fbbf24,#f59e0b)",minWidth: inTransit ? 30 : 0}}/>
          <div style={{flex:pendingDeliv,height:6,background:"rgba(255,255,255,0.18)",borderRadius:"0 9999px 9999px 0",minWidth: pendingDeliv ? 30 : 0}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7}}>
          <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.50)"}}>Próxima entrega</span>
          <span style={{font:"900 11px/1 Inter",color:"white"}}>11:30 · Distribuidora El Roble</span>
        </div>
      </div>
    </div>
  );
}

function DeliveryRow({ delivery, onTap }) {
  const palette =
    delivery.status === "delivered" ? "emeraldSolid"
    : delivery.status === "intransit" ? "amberSolid"
    : "indigoSolid";
  const statusLabel =
    delivery.status === "delivered" ? "Entregada"
    : delivery.status === "intransit" ? "En ruta"
    : "Pendiente";
  const pill =
    delivery.status === "delivered" ? "success"
    : delivery.status === "intransit" ? "warning"
    : "accent";
  return (
    <div className="sf-row sf-press" onClick={() => onTap?.(delivery)} style={{cursor:"pointer"}}>
      <IconChip name="Truck" palette={palette} size={42} icSize={18}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-indigo-600)",background:"var(--sf-indigo-50)",padding:"2px 6px",borderRadius:5}}>{delivery.code}</span>
          <Pill kind={pill}>{statusLabel}</Pill>
        </div>
        <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{delivery.customer}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
          <span style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,minWidth:0}}>{delivery.address}</span>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{font:"900 14px/1 Inter",color:"var(--sf-fg-1)"}} className="sf-tnum">{delivery.eta}</div>
        <div style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)",marginTop:4}}>{delivery.items} ítems · {delivery.weight}</div>
      </div>
    </div>
  );
}

function TransferRow({ transfer, compact }) {
  const palette =
    transfer.status === "received" ? "emerald"
    : transfer.status === "intransit" ? "amber"
    : "indigo";
  const pill =
    transfer.status === "received" ? "success"
    : transfer.status === "intransit" ? "warning"
    : "accent";
  const statusLabel =
    transfer.status === "received" ? "Recibido"
    : transfer.status === "intransit" ? "En ruta"
    : "Pendiente";
  return (
    <div className="sf-row sf-press">
      <IconChip name="RefreshCw" palette={palette} size={42} icSize={18}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-indigo-600)",background:"var(--sf-indigo-50)",padding:"2px 6px",borderRadius:5}}>{transfer.code}</span>
          <Pill kind={pill}>{statusLabel}</Pill>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
          <span style={{font:"800 12px/1.2 Inter",color:"var(--sf-fg-1)"}}>{transfer.from}</span>
          <Icon name="ChevronRight" size={12} style={{color:"var(--sf-fg-4)"}}/>
          <span style={{font:"800 12px/1.2 Inter",color:"var(--sf-fg-1)"}}>{transfer.to}</span>
        </div>
        {!compact && (
          <div style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)",marginTop:5}}>
            {transfer.items} ítems · creado {transfer.created} · {transfer.driver}
          </div>
        )}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div className="sf-tnum" style={{font:"900 18px/1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.02em"}}>{transfer.items}</div>
        <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginTop:4}}>ítems</div>
      </div>
    </div>
  );
}

function KardexRow({ move }) {
  const palette =
    move.type === "sale"     ? "blueSolid"
    : move.type === "transfer" ? "indigoSolid"
    : move.type === "receive"  ? "emeraldSolid"
    : move.type === "return"   ? "purpleSolid"
    : "amberSolid";
  const ic =
    move.type === "sale"     ? "ShoppingCart"
    : move.type === "transfer" ? "RefreshCw"
    : move.type === "receive"  ? "Package"
    : move.type === "return"   ? "RefreshCw"
    : "Filter";
  const typeLabel =
    move.type === "sale"     ? "Venta"
    : move.type === "transfer" ? "Traslado"
    : move.type === "receive"  ? "Recepción"
    : move.type === "return"   ? "Devolución"
    : "Ajuste";
  const isNeg = move.qty < 0;
  return (
    <div className="sf-row sf-press">
      <IconChip name={ic} palette={palette} size={42} icSize={16}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-fg-3)",background:"var(--sf-slate-100)",padding:"2px 6px",borderRadius:5}}>{move.sku}</span>
          <Pill kind="neutral">{typeLabel}</Pill>
        </div>
        <div style={{font:"800 12px/1.2 Inter",color:"var(--sf-fg-1)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{move.product}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{move.at}</span>
          <span style={{width:3,height:3,borderRadius:9999,background:"var(--sf-slate-300)"}}/>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>{move.by}</span>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div className="sf-tnum" style={{font:"900 16px/1 Inter",color: isNeg ? "var(--sf-danger)" : "var(--sf-success)",letterSpacing:"-0.02em"}}>
          {isNeg ? "" : "+"}{move.qty}
        </div>
        <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginTop:4}}>saldo {move.balance}</div>
      </div>
    </div>
  );
}

window.LogisticsHomeTab = LogisticsHomeTab;
window.TransfersTab = TransfersTab;
window.KardexTab = KardexTab;
window.LogisticsHero = LogisticsHero;
window.DeliveryRow = DeliveryRow;
window.TransferRow = TransferRow;
window.KardexRow = KardexRow;


// =================== AdminTabs.jsx ===================
// AdminTabs.jsx — Administrador General screens.
// Home: multi-branch overview, financial KPIs, alerts
// Branches: per-branch performance
// Users: team management

function AdminHomeTab({ onJumpTo }) {
  const totalSales = BRANCH_METRICS.reduce((s, b) => s + b.sales, 0);
  const totalTarget = BRANCH_METRICS.reduce((s, b) => s + b.target, 0);
  const totalTxns = BRANCH_METRICS.reduce((s, b) => s + b.txns, 0);
  const totalSellers = BRANCH_METRICS.reduce((s, b) => s + b.sellers, 0);

  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:18}}>
      <AdminHero sales={totalSales} target={totalTarget} branches={BRANCH_METRICS.length} sellers={totalSellers} txns={totalTxns}/>

      {/* Quick actions */}
      <div style={{display:"flex",gap:8}}>
        <QuickActionBtn ic="Building2" label="Sucursales" palette="indigoSolid"  onClick={() => onJumpTo("branches")}/>
        <QuickActionBtn ic="Users"     label="Equipo"     badge={totalSellers}    palette="purpleSolid"  onClick={() => onJumpTo("users")}/>
        <QuickActionBtn ic="Activity"  label="Reportes"   palette="emeraldSolid"  onClick={() => alert("Reportes globales")}/>
        <QuickActionBtn ic="Settings"  label="Ajustes"    palette="roseSolid"     onClick={() => alert("Ajustes del sistema")}/>
      </div>

      {/* Branches summary */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:14}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Sucursales · hoy</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Comparativa de rendimiento</div>
          </div>
          <button className="more" onClick={() => onJumpTo("branches")}>Detalle <Icon name="ChevronRight" size={11}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {BRANCH_METRICS.map((b, i) => <BranchRow key={b.id} branch={b} rank={i+1}/>)}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <StatTile label="Ingresos totales"    value={CLP(totalSales)} delta="+22% vs ayer" deltaPositive sparkData={HOURLY_SALES} icon="TrendingUp" palette="indigo"/>
        <StatTile label="Tickets emitidos"    value={String(totalTxns)} delta="+18 vs ayer" deltaPositive sparkData={[{v:30},{v:35},{v:42},{v:48},{v:55},{v:62},{v:75},{v:88}]} icon="Receipt" palette="emerald"/>
        <StatTile label="Equipo activo"       value={`${totalSellers} pers.`} delta="2 en pausa" deltaPositive={false} icon="Users" palette="purple"/>
        <StatTile label="Stock crítico"       value={String(STOCK_ALERTS.length)} delta="+1 hoy" deltaPositive={false} icon="AlertTriangle" palette="amber"/>
      </div>

      {/* Admin alerts */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div className="sf-section-h" style={{marginBottom:12}}>
          <div>
            <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)"}}>Avisos del negocio</div>
            <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginTop:5}}>Eventos importantes</div>
          </div>
          <Pill kind="accent">{ADMIN_ALERTS.length}</Pill>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ADMIN_ALERTS.map(a => <AdminAlertRow key={a.id} alert={a}/>)}
        </div>
      </div>
    </div>
  );
}

function BranchesTab({ onOpenBranch }) {
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Sucursales</h2>
        <Pill kind="accent">{BRANCH_METRICS.length} activas</Pill>
      </div>

      {/* Aggregate strip */}
      <div className="sf-card-soft" style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <MiniStat label="Cumplimiento avg"  value={Math.round(BRANCH_METRICS.reduce((s,b)=>s + (b.sales/b.target),0)/BRANCH_METRICS.length*100) + "%"} accent="indigo"/>
        <MiniStat label="Mejor sucursal"    value="Centro" accent="emerald"/>
        <MiniStat label="Necesita atención" value={String(BRANCH_METRICS.filter(b => b.status === "attention").length)} accent="amber"/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {BRANCH_METRICS.map((b, i) => <BranchCard key={b.id} branch={b} rank={i+1} onTap={onOpenBranch}/>)}
      </div>

      <button className="sf-btn-cta" style={{marginTop:6}}>
        <Icon name="Plus" size={14} strokeWidth={2.8}/> Crear nueva sucursal
      </button>
    </div>
  );
}

function UsersTab({ onOpenUser }) {
  const [scope, setScope] = React.useState("all"); // all | vendedor | jefe | logistica
  const filtered = scope === "all" ? TEAM_MEMBERS : TEAM_MEMBERS.filter(m => m.role.toLowerCase().includes(scope));
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{font:"900 22px/1 Inter",letterSpacing:"-0.025em",margin:0}}>Equipo global</h2>
        <Pill kind="accent">{TEAM_MEMBERS.length} usuarios</Pill>
      </div>

      <div className="sf-segmented" style={{width:"100%"}}>
        {[
          { id:"all",       label:"Todos" },
          { id:"vendedor",  label:"Vendedores" },
          { id:"cajero",    label:"Cajeros" },
        ].map(f => (
          <button key={f.id} className={scope === f.id ? "active" : ""} style={{flex:1}} onClick={() => setScope(f.id)}>{f.label}</button>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(m => <UserRow key={m.id} member={m} onTap={onOpenUser}/>)}
      </div>

      <button className="sf-btn-cta" style={{marginTop:6}}>
        <Icon name="Plus" size={14} strokeWidth={2.8}/> Invitar a nuevo usuario
      </button>
    </div>
  );
}

// ===== Admin-specific components =====

function AdminHero({ sales, target, branches, sellers, txns }) {
  const progress = Math.min(1, sales / target);
  return (
    <div className="sf-hero-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="ShieldCheck" size={14} style={{color:"#a5b4fc"}}/>
            <span style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.78)"}}>Vista global</span>
          </div>
          <div style={{font:"900 11px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)",marginTop:14}}>
            Ingresos consolidados · hoy
          </div>
        </div>
        <div className="sf-glass-strong" style={{borderRadius:14,padding:"6px 10px",display:"flex",alignItems:"center",gap:7}}>
          <Icon name="Building2" size={12} style={{color:"#fde68a"}}/>
          <span style={{font:"900 11px/1 Inter",color:"white"}}>{branches} sucursales</span>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginTop:8}}>
        <div style={{flex:1,minWidth:0}}>
          <MoneyTicker value={sales} animate style={{font:"900 36px/1 Inter",color:"white",letterSpacing:"-0.03em",display:"block"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Pill kind="dark">{txns} tickets</Pill>
            <span style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)"}}>· meta {CLP(target)}</span>
          </div>
        </div>
        <ProgressRing size={76} stroke={6} progress={progress}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <span style={{font:"900 16px/1 Inter",color:"white"}}>{Math.round(progress*100)}%</span>
            <span style={{font:"900 7px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.6)",marginTop:4}}>Meta</span>
          </div>
        </ProgressRing>
      </div>

      {/* Quick stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:18}}>
        {[
          { lbl:"Equipo",    v: `${sellers}`, sub: "personas" },
          { lbl:"Crecim.",   v: "+22%",       sub: "vs ayer" },
          { lbl:"Ticket avg",v: CLP(Math.round(sales/Math.max(1,txns))), sub: "" },
        ].map((s,i) => (
          <div key={i} className="sf-glass" style={{borderRadius:14,padding:"10px 12px"}}>
            <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.55)"}}>{s.lbl}</div>
            <div style={{font:"900 16px/1 Inter",color:"white",marginTop:6,letterSpacing:"-0.02em"}} className="sf-tnum">{s.v}</div>
            {s.sub && <div style={{font:"700 9px/1 Inter",color:"rgba(255,255,255,0.45)",marginTop:4}}>{s.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchRow({ branch, rank }) {
  const progress = Math.min(1, branch.sales / branch.target);
  const pct = Math.round(progress * 100);
  const statusColor = branch.status === "healthy" ? "var(--sf-success)" : "var(--sf-warning)";
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 0"}}>
      <span style={{font:"900 11px/1 Inter",color:rank===1?"#f59e0b":"var(--sf-fg-4)",background:rank===1?"#fffbeb":"var(--sf-slate-100)",padding:"5px 8px",borderRadius:8,letterSpacing:"-0.01em",minWidth:22,textAlign:"center"}}>#{rank}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <span style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)"}}>{branch.name}</span>
          <span className="sf-tnum" style={{font:"900 13px/1 Inter",color:"var(--sf-fg-1)"}}>{CLP(branch.sales)}</span>
        </div>
        <div style={{height:8,background:"var(--sf-slate-100)",borderRadius:9999,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress*100}%`,background: branch.growth >= 0 ? "linear-gradient(to right,#6366f1,#4f46e5)" : "linear-gradient(to right,#f59e0b,#d97706)",borderRadius:9999,transition:"width 900ms var(--sf-spring)"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
          <span style={{font:"700 9px/1 Inter",color:"var(--sf-fg-4)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{branch.txns} tickets · {branch.sellers} pers.</span>
          <span style={{font:"900 10px/1 Inter",color: branch.growth >= 0 ? "var(--sf-success)" : "var(--sf-warning)",display:"inline-flex",alignItems:"center",gap:3}}>
            <Icon name="TrendingUp" size={9} strokeWidth={2.5} style={{transform: branch.growth >= 0 ? "none" : "rotate(180deg)"}}/>
            {branch.growth >= 0 ? "+" : ""}{branch.growth}%
          </span>
        </div>
      </div>
    </div>
  );
}

function BranchCard({ branch, rank, onTap }) {
  const progress = Math.min(1, branch.sales / branch.target);
  const pct = Math.round(progress * 100);
  return (
    <div className="sf-card-soft sf-press" style={{padding:16,cursor:"pointer"}} onClick={() => onTap?.(branch)}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{
          width:46,height:46,borderRadius:14,
          background:"linear-gradient(140deg,#4f46e5,#6366f1)",color:"white",
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
          boxShadow:"0 8px 16px -6px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.20)",
        }}>
          <Icon name="Building2" size={20}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{font:"900 9px/1 Inter",color:rank===1?"#f59e0b":"var(--sf-fg-4)",background:rank===1?"#fffbeb":"var(--sf-slate-100)",padding:"3px 6px",borderRadius:5}}>#{rank}</span>
            <div style={{font:"900 14px/1.1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.015em"}}>Sucursal {branch.name}</div>
          </div>
          <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:5}}>{branch.sellers} personas · {branch.txns} tickets</div>
        </div>
        <Pill kind={branch.status === "healthy" ? "success" : "warning"}>{branch.status === "healthy" ? "OK" : "Atención"}</Pill>
      </div>

      <div style={{marginTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-4)"}}>Cumplimiento meta</span>
          <span className="sf-tnum" style={{font:"900 11px/1 Inter",color:"var(--sf-indigo-600)"}}>{CLP(branch.sales)} / {CLP(branch.target)}</span>
        </div>
        <div style={{height:10,background:"var(--sf-slate-100)",borderRadius:9999,overflow:"hidden"}}>
          <div style={{
            height:"100%",width:`${progress*100}%`,
            background: branch.status === "healthy" ? "linear-gradient(to right,#6366f1,#4f46e5)" : "linear-gradient(to right,#f59e0b,#d97706)",
            borderRadius:9999,transition:"width 900ms var(--sf-spring)",
          }}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7}}>
          <span style={{font:"900 9px/1 Inter",color:"var(--sf-fg-4)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{pct}% completado</span>
          <span style={{font:"900 10px/1 Inter",color: branch.growth >= 0 ? "var(--sf-success)" : "var(--sf-warning)",display:"inline-flex",alignItems:"center",gap:3}}>
            <Icon name="TrendingUp" size={9} strokeWidth={2.5} style={{transform: branch.growth >= 0 ? "none" : "rotate(180deg)"}}/>
            {branch.growth >= 0 ? "+" : ""}{branch.growth}% semana
          </span>
        </div>
      </div>
    </div>
  );
}

function UserRow({ member, onTap }) {
  return (
    <div className="sf-row sf-press" onClick={() => onTap?.(member)} style={{cursor:"pointer"}}>
      <Avatar initial={member.initial} size={42} palette="indigoSolid"/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{font:"800 13px/1.2 Inter",color:"var(--sf-fg-1)"}}>{member.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
          <Pill kind="accent">{member.role}</Pill>
          <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)"}}>· Sucursal Centro</span>
        </div>
      </div>
      <button className="sf-tap" style={{
        width:36,height:36,borderRadius:11,background:"var(--sf-slate-100)",border:"none",
        color:"var(--sf-fg-2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
      }}><Icon name="Settings" size={14}/></button>
    </div>
  );
}

function AdminAlertRow({ alert }) {
  const palette = alert.type === "warning" ? "amber" : alert.type === "success" ? "emerald" : "blue";
  const ic = alert.type === "warning" ? "AlertTriangle" : alert.type === "success" ? "CheckCircle2" : "Bell";
  return (
    <div className="sf-row sf-press" style={{padding:12}}>
      <IconChip name={ic} palette={palette} size={36} icSize={15}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{font:"900 12px/1.2 Inter",color:"var(--sf-fg-1)"}}>{alert.title}</div>
        <div style={{font:"700 11px/1.4 Inter",color:"var(--sf-fg-3)",marginTop:4}}>{alert.detail}</div>
      </div>
      <span style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)",whiteSpace:"nowrap"}}>{alert.time}</span>
    </div>
  );
}

window.AdminHomeTab = AdminHomeTab;
window.BranchesTab = BranchesTab;
window.UsersTab = UsersTab;
window.AdminHero = AdminHero;
window.BranchRow = BranchRow;
window.BranchCard = BranchCard;
window.UserRow = UserRow;
window.AdminAlertRow = AdminAlertRow;


// =================== RoleSheets.jsx ===================
// RoleSheets.jsx — detail sheets used across roles:
// - ApprovalDetailSheet (Jefe)
// - DeliveryDetailSheet (Logística)
// - BranchDetailSheet (Admin)
// - UserDetailSheet (Admin)

// ===== ApprovalDetailSheet =====
function ApprovalDetailSheet({ open, onClose, approval, onApprove, onReject }) {
  if (!approval) return null;
  const ic = approval.type === "refund" ? "RefreshCw" : approval.type === "discount" ? "Tag" : "Lock";
  const palette = approval.risk === "high" ? "roseSolid" : approval.risk === "med" ? "amberSolid" : "blueSolid";
  return (
    <SheetShell open={open} onClose={onClose} title={approval.title} subtitle="Aprobación requerida">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Hero summary */}
        <div className="sf-card-soft" style={{padding:16,display:"flex",alignItems:"center",gap:14,background:"linear-gradient(140deg,#fbfbff,white)"}}>
          <IconChip name={ic} palette={palette} size={56} icSize={24}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:"900 16px/1.1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.02em"}}>{approval.detail}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
              <Pill kind={approval.risk === "high" ? "danger" : approval.risk === "med" ? "warning" : "info"}>
                riesgo {approval.risk === "high" ? "alto" : approval.risk === "med" ? "medio" : "bajo"}
              </Pill>
              <span style={{font:"700 11px/1 Inter",color:"var(--sf-fg-4)"}}>{approval.time}</span>
            </div>
          </div>
        </div>

        {/* Origin info */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:12}}>Solicitado por</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Avatar initial={approval.seller.charAt(0)} size={44} palette="indigoSolid"/>
            <div style={{flex:1}}>
              <div style={{font:"900 13px/1.2 Inter",color:"var(--sf-fg-1)"}}>{approval.seller}</div>
              <div style={{font:"700 11px/1.2 Inter",color:"var(--sf-fg-4)",marginTop:4}}>Vendedor · Sucursal Centro</div>
            </div>
            <button className="sf-tap" style={{width:36,height:36,borderRadius:11,background:"var(--sf-slate-100)",border:"none",color:"var(--sf-fg-2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="Mail" size={14}/></button>
          </div>
        </div>

        {/* Context details */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:12}}>Contexto</div>
          {[
            { k:"Tipo",      v: approval.type === "refund" ? "Devolución" : approval.type === "discount" ? "Descuento" : "Cierre de caja" },
            { k:"Sucursal",  v:"Centro" },
            { k:"Turno",     v:"08:30 → en curso" },
            { k:"Motivo",    v: approval.type === "refund" ? "Producto en mal estado" : approval.type === "discount" ? "Cliente VIP" : "Diferencia de caja" },
            { k:"Monto",     v: approval.detail.match(/\$[\d.,]+/)?.[0] || "—", mono:true },
          ].map((r,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<4?"1px solid var(--sf-stroke-1)":"none"}}>
              <span style={{font:"700 11px/1 Inter",color:"var(--sf-fg-4)",textTransform:"uppercase",letterSpacing:"0.10em"}}>{r.k}</span>
              <span className="sf-tnum" style={{font:"900 12px/1 Inter",color:"var(--sf-fg-1)",fontFamily:r.mono?"ui-monospace,monospace":"Inter,sans-serif"}}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* Note (optional) */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:8}}>Nota interna (opcional)</div>
          <textarea placeholder="Agrega un comentario antes de aprobar…" style={{
            width:"100%",minHeight:60,padding:12,fontFamily:"inherit",fontSize:13,fontWeight:500,
            border:"1px solid var(--sf-stroke-1)",borderRadius:12,background:"var(--sf-slate-50)",
            outline:"none",resize:"none",color:"var(--sf-fg-1)",
          }}/>
        </div>

        {/* Actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
          <button onClick={() => { onReject?.(approval); onClose(); }} className="sf-tap" style={{
            height:54,borderRadius:16,
            background:"white",border:"1px solid var(--sf-danger-border)",color:"var(--sf-danger)",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
          }}>
            <Icon name="X" size={14} strokeWidth={3}/> Rechazar
          </button>
          <button onClick={() => { onApprove?.(approval); onClose(); }} className="sf-tap" style={{
            height:54,borderRadius:16,
            background:"linear-gradient(140deg,#10b981,#059669)",border:"none",color:"white",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
            boxShadow:"0 12px 24px -8px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}>
            <Icon name="Check" size={14} strokeWidth={3}/> Aprobar
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

// ===== DeliveryDetailSheet =====
function DeliveryDetailSheet({ open, onClose, delivery, onStart, onComplete }) {
  if (!delivery) return null;
  const isPending = delivery.status === "pending";
  const isInTransit = delivery.status === "intransit";
  const isDelivered = delivery.status === "delivered";

  return (
    <SheetShell open={open} onClose={onClose} title={delivery.code} subtitle="Detalle de entrega" height="90%">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Map placeholder */}
        <div style={{
          height:160,borderRadius:18,position:"relative",overflow:"hidden",
          background:
            "radial-gradient(120% 80% at 30% 30%, rgba(99,102,241,0.20), transparent 50%)," +
            "radial-gradient(120% 80% at 70% 70%, rgba(168,85,247,0.18), transparent 60%)," +
            "linear-gradient(140deg,#1e293b,#0f172a)",
          color:"white",border:"1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Fake grid */}
          <svg width="100%" height="100%" style={{position:"absolute",inset:0,opacity:0.18}}>
            <defs>
              <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
                <path d="M22 0H0V22" fill="none" stroke="white" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
          {/* Route line */}
          <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
            <path d="M 30 130 Q 100 70, 170 100 T 320 50" stroke="#a5b4fc" strokeWidth="3" fill="none" strokeDasharray="6 4" strokeLinecap="round"/>
          </svg>
          {/* Origin pin */}
          <div style={{position:"absolute",left:18,bottom:18,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:14,height:14,borderRadius:9999,background:"#34d399",boxShadow:"0 0 0 4px rgba(52,211,153,0.30)",border:"2px solid white"}}/>
            <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em"}}>Bodega</span>
          </div>
          {/* Destination pin */}
          <div style={{position:"absolute",right:18,top:30,display:"flex",alignItems:"center",gap:6,flexDirection:"row-reverse"}}>
            <div style={{
              width:30,height:30,borderRadius:11,background:"linear-gradient(140deg,#f59e0b,#d97706)",color:"white",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 8px 16px -4px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
              border:"2px solid white",
            }}><Icon name="Building2" size={14}/></div>
          </div>
          {/* ETA card */}
          <div className="sf-glass-strong" style={{
            position:"absolute",left:16,top:16,padding:"8px 12px",borderRadius:12,
            display:"flex",alignItems:"center",gap:8,
          }}>
            <Icon name="Activity" size={13} style={{color:"#fbbf24"}}/>
            <div style={{lineHeight:1}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.65)"}}>ETA</div>
              <div style={{font:"900 12px/1 Inter",color:"white",marginTop:3}}>{delivery.eta} · 2.4 km</div>
            </div>
          </div>
        </div>

        {/* Status / customer */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <Pill kind={isDelivered ? "success" : isInTransit ? "warning" : "accent"}>
              {isDelivered ? "Entregada" : isInTransit ? "En ruta" : "Pendiente"}
            </Pill>
            <span style={{font:"700 10px/1 ui-monospace,monospace",color:"var(--sf-fg-4)"}}>{delivery.code}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Avatar initial={delivery.customer.charAt(0)} size={46} palette="purpleSolid"/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{font:"900 14px/1.2 Inter",color:"var(--sf-fg-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{delivery.customer}</div>
              <div style={{font:"700 11px/1.3 Inter",color:"var(--sf-fg-3)",marginTop:5}}>{delivery.address}</div>
            </div>
            <button className="sf-tap" style={{width:40,height:40,borderRadius:12,background:"var(--sf-indigo-50)",border:"none",color:"var(--sf-indigo-600)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="Smartphone" size={16}/></button>
          </div>
        </div>

        {/* Cargo info */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:12}}>Carga</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <MiniStat label="Ítems"    value={String(delivery.items)} accent="indigo"/>
            <MiniStat label="Peso"     value={delivery.weight}        accent="emerald"/>
            <MiniStat label="Origen"   value={delivery.branch}        accent="blue"/>
          </div>
        </div>

        {/* Timeline */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:14}}>Línea de tiempo</div>
          {[
            { lbl:"Orden generada",   time:"08:15", done:true },
            { lbl:"Preparada en bodega", time:"09:42", done:true },
            { lbl:"En ruta de reparto", time:"10:30", done:isInTransit || isDelivered },
            { lbl:"Entregada",        time:delivery.eta, done:isDelivered },
          ].map((step, i, arr) => (
            <div key={i} style={{display:"flex",gap:12,position:"relative"}}>
              <div style={{flexShrink:0,position:"relative",display:"flex",alignItems:"flex-start"}}>
                <div style={{
                  width:24,height:24,borderRadius:9999,
                  background: step.done ? "linear-gradient(140deg,#10b981,#059669)" : "var(--sf-slate-100)",
                  color: step.done ? "white" : "var(--sf-fg-4)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:1,
                  boxShadow: step.done ? "0 4px 10px -3px rgba(16,185,129,0.55)" : "none",
                }}>
                  {step.done ? <Icon name="Check" size={12} strokeWidth={3}/> : <span style={{width:6,height:6,borderRadius:9999,background:"var(--sf-fg-4)"}}/>}
                </div>
                {i < arr.length - 1 && <div style={{position:"absolute",left:11,top:24,width:2,height:24,background: step.done && arr[i+1].done ? "linear-gradient(180deg,#10b981,#059669)" : "var(--sf-stroke-2)"}}/>}
              </div>
              <div style={{flex:1,paddingBottom:14}}>
                <div style={{font:"800 12px/1.2 Inter",color: step.done ? "var(--sf-fg-1)" : "var(--sf-fg-4)"}}>{step.lbl}</div>
                <div style={{font:"700 10px/1 Inter",color:"var(--sf-fg-4)",marginTop:4}}>{step.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Action */}
        {isPending && (
          <button onClick={() => { onStart?.(delivery); onClose(); }} className="sf-btn-cta">
            <Icon name="Truck" size={14}/> Iniciar ruta
          </button>
        )}
        {isInTransit && (
          <button onClick={() => { onComplete?.(delivery); onClose(); }} className="sf-btn-cta">
            <Icon name="Check" size={14} strokeWidth={3}/> Confirmar entrega
          </button>
        )}
        {isDelivered && (
          <div style={{
            padding:14,borderRadius:16,
            background:"linear-gradient(140deg,#ecfdf5,#d1fae5)",border:"1px solid #a7f3d0",
            display:"flex",alignItems:"center",gap:12,
          }}>
            <IconChip name="CheckCircle2" palette="emeraldSolid" size={42} icSize={18}/>
            <div>
              <div style={{font:"900 11px/1.2 Inter",color:"#065f46"}}>Entrega completada</div>
              <div style={{font:"700 11px/1.3 Inter",color:"var(--sf-fg-3)",marginTop:4}}>Firma digital recibida</div>
            </div>
          </div>
        )}
      </div>
    </SheetShell>
  );
}

// ===== BranchDetailSheet =====
function BranchDetailSheet({ open, onClose, branch }) {
  if (!branch) return null;
  const progress = Math.min(1, branch.sales / branch.target);
  return (
    <SheetShell open={open} onClose={onClose} title={`Sucursal ${branch.name}`} subtitle="Resumen del día" height="85%">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Header card */}
        <div className="sf-hero-card" style={{padding:20,borderRadius:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{
              width:50,height:50,borderRadius:14,
              background:"rgba(255,255,255,0.10)",border:"1px solid rgba(255,255,255,0.15)",
              display:"flex",alignItems:"center",justifyContent:"center",color:"white",
            }}>
              <Icon name="Building2" size={22}/>
            </div>
            <div style={{flex:1}}>
              <div style={{font:"900 18px/1.1 Inter",color:"white",letterSpacing:"-0.02em"}}>Sucursal {branch.name}</div>
              <div style={{display:"flex",gap:6,marginTop:7}}>
                <Pill kind="dark">{branch.sellers} personas</Pill>
                <Pill kind={branch.status === "healthy" ? "success" : "warning"}>{branch.status === "healthy" ? "OK" : "Atención"}</Pill>
              </div>
            </div>
          </div>
          <div style={{marginTop:18}}>
            <MoneyTicker value={branch.sales} animate style={{font:"900 36px/1 Inter",color:"white",letterSpacing:"-0.03em",display:"block"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
              <Pill kind="dark">{branch.txns} tickets</Pill>
              <span style={{font:"700 11px/1 Inter",color:"rgba(255,255,255,0.65)"}}>· meta {CLP(branch.target)}</span>
            </div>
            <div style={{height:10,background:"rgba(255,255,255,0.18)",borderRadius:9999,padding:2,marginTop:14,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progress*100}%`,background:"linear-gradient(to right,#fbbf24,#fde68a)",borderRadius:9999,transition:"width 1.2s var(--sf-spring)"}}/>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <StatTile label="Crecimiento vs ayer" value={`${branch.growth >= 0 ? "+" : ""}${branch.growth}%`} sparkData={[{v:10},{v:14},{v:12},{v:18},{v:16},{v:20},{v:19},{v:21}]} icon="TrendingUp" palette={branch.growth >= 0 ? "emerald" : "amber"}/>
          <StatTile label="Ticket promedio"     value={CLP(Math.round(branch.sales / Math.max(1,branch.txns)))} sparkData={[{v:14},{v:18},{v:17},{v:21},{v:19},{v:22}]} icon="Receipt" palette="indigo"/>
        </div>

        {/* Top sellers in this branch */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:12}}>Ranking del local</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[...TEAM_MEMBERS].sort((a,b) => b.sales - a.sales).slice(0,3).map((m,i) => <TeamRow key={m.id} member={m} rank={i+1} compact/>)}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button className="sf-tap" style={{
            height:48,borderRadius:14,background:"white",border:"1px solid var(--sf-stroke-1)",color:"var(--sf-fg-1)",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
          }}><Icon name="Settings" size={13}/> Editar</button>
          <button className="sf-tap" style={{
            height:48,borderRadius:14,background:"linear-gradient(140deg,#4f46e5,#6366f1)",border:"none",color:"white",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
            boxShadow:"0 12px 24px -8px rgba(79,70,229,0.55)",
          }}><Icon name="Activity" size={13}/> Ver reportes</button>
        </div>
      </div>
    </SheetShell>
  );
}

// ===== UserDetailSheet =====
function UserDetailSheet({ open, onClose, member }) {
  if (!member) return null;
  const progress = Math.min(1, member.sales / Math.max(1, member.target));
  return (
    <SheetShell open={open} onClose={onClose} title={member.name} subtitle="Perfil del usuario">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Hero */}
        <div className="sf-hero-card" style={{padding:20,borderRadius:24}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Avatar initial={member.initial} size={56} palette="glass" ring/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{font:"900 18px/1.1 Inter",letterSpacing:"-0.02em",color:"white"}}>{member.name}</div>
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <Pill kind="dark">{member.role}</Pill>
                <Pill kind="dark">Sucursal Centro</Pill>
              </div>
              <div style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)",marginTop:8,fontFamily:"ui-monospace,monospace"}}>
                {member.name.toLowerCase().replace(/\s/g,".")}@stockflow.com
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:18}}>
            <div className="sf-glass" style={{borderRadius:14,padding:"10px 12px"}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.55)"}}>Ventas hoy</div>
              <div className="sf-tnum" style={{font:"900 14px/1 Inter",color:"white",marginTop:6,letterSpacing:"-0.02em"}}>{CLP(member.sales)}</div>
            </div>
            <div className="sf-glass" style={{borderRadius:14,padding:"10px 12px"}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.55)"}}>Tickets</div>
              <div className="sf-tnum" style={{font:"900 14px/1 Inter",color:"white",marginTop:6,letterSpacing:"-0.02em"}}>{member.count}</div>
            </div>
            <div className="sf-glass" style={{borderRadius:14,padding:"10px 12px"}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.55)"}}>Meta</div>
              <div className="sf-tnum" style={{font:"900 14px/1 Inter",color:"white",marginTop:6,letterSpacing:"-0.02em"}}>{Math.round(progress*100)}%</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <span style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--sf-fg-2)"}}>Avance comercial</span>
            <span className="sf-tnum" style={{font:"900 11px/1 Inter",color:"var(--sf-indigo-600)"}}>{CLP(member.sales)} / {CLP(member.target)}</span>
          </div>
          <div style={{height:12,background:"var(--sf-slate-100)",borderRadius:9999,padding:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress*100}%`,background:"linear-gradient(to right,#6366f1,#4f46e5)",borderRadius:9999,transition:"width 900ms var(--sf-spring)"}}/>
          </div>
        </div>

        {/* Permissions */}
        <div className="sf-card-soft" style={{padding:14}}>
          <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)",marginBottom:12}}>Permisos asignados</div>
          {[
            { lbl:"Procesar ventas (POS)",    on:true },
            { lbl:"Aprobar devoluciones",     on:false },
            { lbl:"Acceso a kardex",          on:false },
            { lbl:"Cambiar de sucursal",      on:false },
          ].map((p,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<3?"1px solid var(--sf-stroke-1)":"none"}}>
              <span style={{font:"700 12px/1.2 Inter",color:"var(--sf-fg-1)"}}>{p.lbl}</span>
              <Toggle on={p.on}/>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button className="sf-tap" style={{
            height:48,borderRadius:14,background:"white",border:"1px solid var(--sf-danger-border)",color:"var(--sf-danger)",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
          }}><Icon name="LogOut" size={13}/> Suspender</button>
          <button className="sf-tap" style={{
            height:48,borderRadius:14,background:"linear-gradient(140deg,#4f46e5,#6366f1)",border:"none",color:"white",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",
            boxShadow:"0 12px 24px -8px rgba(79,70,229,0.55)",
          }}><Icon name="Settings" size={13}/> Editar rol</button>
        </div>
      </div>
    </SheetShell>
  );
}

// ===== Toggle switch (uses CSS transitions only) =====
function Toggle({ on: initialOn = false, onChange }) {
  const [on, setOn] = React.useState(initialOn);
  React.useEffect(() => { setOn(initialOn); }, [initialOn]);
  const toggle = () => {
    const next = !on;
    setOn(next);
    onChange?.(next);
  };
  return (
    <button onClick={toggle} className="sf-tap" style={{
      width:42,height:24,borderRadius:9999,padding:2,
      background: on ? "linear-gradient(140deg,#10b981,#059669)" : "var(--sf-slate-200)",
      border:"none",cursor:"pointer",position:"relative",
      transition:"background 200ms var(--sf-spring)",
      boxShadow: on ? "inset 0 1px 2px rgba(0,0,0,0.10)" : "inset 0 1px 2px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        width:20,height:20,borderRadius:9999,background:"white",
        transform: on ? "translateX(18px)" : "translateX(0)",
        transition:"transform 220ms var(--sf-spring)",
        boxShadow:"0 2px 4px rgba(15,23,42,0.15)",
      }}/>
    </button>
  );
}

window.ApprovalDetailSheet = ApprovalDetailSheet;
window.DeliveryDetailSheet = DeliveryDetailSheet;
window.BranchDetailSheet = BranchDetailSheet;
window.UserDetailSheet = UserDetailSheet;
window.Toggle = Toggle;


