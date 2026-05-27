// SideDrawer — premium drawer with mesh background, profile header card,
// branch switcher, sectioned nav, footer.

function SideDrawer({ open, onClose, branch, onSwitchBranch, onLogout, onJumpTo, profile = PROFILE, role = "vendedor" }) {
  const [mounted, setMounted] = React.useState(false);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const id = setTimeout(() => setShow(true), 20);
      return () => clearTimeout(id);
    } else if (mounted) {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 380);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <>
      <div className={`sf-scrim-bg ${show ? "open" : ""}`} onClick={onClose}/>
      <div className={`sf-drawer ${show ? "open" : ""}`}>
        {/* Header */}
        <div style={{padding:"22px 22px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",position:"relative",zIndex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{
                width:30,height:30,borderRadius:10,
                background:"linear-gradient(140deg,#4f46e5,#6366f1)",
                display:"flex",alignItems:"center",justifyContent:"center",color:"white",
                boxShadow:"0 6px 14px -4px rgba(79,70,229,0.55)",
              }}>
                <Icon name="Zap" size={15} fill="currentColor" strokeWidth={0}/>
              </div>
              <div style={{font:"900 12px/1 Inter",color:"white",letterSpacing:"-0.01em"}}>StockFlow</div>
            </div>
            <button onClick={onClose} className="sf-tap" style={{
              width:32,height:32,borderRadius:10,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.06)",color:"white",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><Icon name="X" size={14}/></button>
          </div>

          {/* Identity card */}
          <div style={{
            background:"linear-gradient(140deg,rgba(99,102,241,0.20),rgba(168,85,247,0.10))",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:18,padding:14,display:"flex",alignItems:"center",gap:13,
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            <Avatar initial={profile.initial} size={50} palette="indigoSolid" ring/>
            <div style={{minWidth:0,flex:1}}>
              <div style={{font:"900 15px/1.1 Inter",letterSpacing:"-0.02em",color:"white"}}>{profile.name}</div>
              <div style={{font:"700 10px/1.4 Inter",color:"rgba(255,255,255,0.55)",marginTop:5,fontFamily:"ui-monospace,monospace"}}>{profile.email}</div>
              <div style={{display:"flex",gap:5,marginTop:7}}>
                <Pill kind="dark">{profile.roleLabel}</Pill>
              </div>
            </div>
          </div>
        </div>

        {/* Branch switcher */}
        <div style={{padding:"18px 22px 10px",position:"relative",zIndex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)"}}>Sucursal activa</span>
            <span style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"#a5b4fc"}}>3 disponibles</span>
          </div>
          {BRANCHES.map(b => {
            const active = b.id === branch.id;
            return (
              <button key={b.id} onClick={() => { onSwitchBranch(b); onClose(); }} className="sf-tap" style={{
                width:"100%",display:"flex",alignItems:"center",gap:12,
                padding:"11px 12px",borderRadius:14,
                background: active ? "linear-gradient(140deg,rgba(99,102,241,0.25),rgba(79,70,229,0.10))" : "transparent",
                border:`1px solid ${active ? "rgba(99,102,241,0.40)" : "transparent"}`,
                color:"white",cursor:"pointer",marginBottom:6,
              }}>
                <div style={{
                  width:36,height:36,borderRadius:11,flexShrink:0,
                  background:active?"linear-gradient(140deg,#4f46e5,#6366f1)":"rgba(255,255,255,0.06)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:active?"0 8px 16px -4px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.18)":"none",
                }}>
                  <Icon name="Building2" size={15}/>
                </div>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{font:"800 13px/1.2 Inter"}}>{b.name}</div>
                  <div style={{font:"700 10px/1.2 Inter",color:"rgba(255,255,255,0.55)",marginTop:4}}>{b.city}</div>
                </div>
                {active && (
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:7,height:7,borderRadius:9999,background:"#34d399",boxShadow:"0 0 0 4px rgba(52,211,153,0.20)",animation:"sf-pulse 1.8s ease-in-out infinite"}}/>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Nav links — vary by role */}
        <div style={{padding:"6px 16px",flex:1,overflowY:"auto",position:"relative",zIndex:1}}>
          {(ROLE_DRAWER_LINKS[role] || []).map((section, si) => (
            <div key={si}>
              <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)",margin: si === 0 ? "6px 8px 8px" : "14px 8px 8px"}}>{section.title}</div>
              {section.items.map((it, i) => (
                <DrawerLink key={i} icon={it.ic} label={it.label} hint={it.hint} badge={it.badge} onClick={it.onClick}/>
              ))}
            </div>
          ))}
        </div>

        {/* Logout */}
        <div style={{padding:"14px 22px 20px",borderTop:"1px solid rgba(255,255,255,0.08)",position:"relative",zIndex:1}}>
          <button onClick={onLogout} className="sf-tap" style={{
            width:"100%",height:48,borderRadius:14,
            background:"linear-gradient(140deg,rgba(244,63,94,0.20),rgba(244,63,94,0.10))",
            border:"1px solid rgba(244,63,94,0.25)",color:"#fda4af",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",whiteSpace:"nowrap",
          }}>
            <Icon name="LogOut" size={15}/> Cerrar sesión
          </button>
          <div style={{textAlign:"center",font:"700 9px/1.4 Inter",color:"rgba(255,255,255,0.35)",marginTop:14,textTransform:"uppercase",letterSpacing:"0.16em"}}>
            v2.1.4 · build 8421 · made in 🇨🇱
          </div>
        </div>
      </div>
    </>
  );
}

function DrawerLink({ icon, label, badge, hint, onClick }) {
  return (
    <button onClick={onClick} className="sf-tap" style={{
      width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 10px",
      background:"none",border:"none",color:"white",cursor:"pointer",borderRadius:12,
    }}>
      <div style={{width:32,height:32,borderRadius:10,background:"rgba(255,255,255,0.06)",
        border:"1px solid rgba(255,255,255,0.04)",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
      }}>
        <Icon name={icon} size={14} style={{color:"rgba(255,255,255,0.85)"}}/>
      </div>
      <span style={{flex:1,textAlign:"left",font:"800 12px/1 Inter"}}>{label}</span>
      {hint && !badge && <span style={{font:"800 10px/1 Inter",color:"rgba(255,255,255,0.45)"}} className="sf-tnum">{hint}</span>}
      {badge && <Pill kind="dark" style={{fontSize:8}}>{badge}</Pill>}
      <Icon name="ChevronRight" size={13} style={{color:"rgba(255,255,255,0.30)"}}/>
    </button>
  );
}

window.SideDrawer = SideDrawer;

// Role-specific drawer links — only show what's relevant to each role.
const ROLE_DRAWER_LINKS = {
  vendedor: [
    { title:"Operaciones", items:[
      { ic:"Receipt",  label:"Historial de ventas",   hint:"6 hoy" },
      { ic:"Users",    label:"Mis clientes",          hint:"1.284" },
      { ic:"Tag",      label:"Cupones y descuentos",  hint:"3 activos" },
      { ic:"Ticket",   label:"Boletas y facturas" },
    ]},
    { title:"Cuenta", items:[
      { ic:"Bell",        label:"Notificaciones",   hint:"3" },
      { ic:"ShieldCheck", label:"Privacidad y seguridad" },
      { ic:"WifiOff",     label:"Sincronización offline" },
      { ic:"Settings",    label:"Ajustes" },
    ]},
  ],
  jefe: [
    { title:"Operaciones del local", items:[
      { ic:"Users",        label:"Mi equipo",            hint:"5 vend." },
      { ic:"CheckCircle2", label:"Aprobaciones",         badge:"3" },
      { ic:"Activity",     label:"Reportes diarios" },
      { ic:"Lock",         label:"Cierre de caja",       hint:"22:00" },
    ]},
    { title:"Inventario y producto", items:[
      { ic:"Package",      label:"Stock del local",      hint:"3 críticos" },
      { ic:"Tag",          label:"Cupones y promos" },
    ]},
    { title:"Cuenta", items:[
      { ic:"Bell",         label:"Notificaciones",       hint:"3" },
      { ic:"ShieldCheck",  label:"Privacidad y seguridad" },
      { ic:"Settings",     label:"Ajustes" },
    ]},
  ],
  logistica: [
    { title:"Operaciones", items:[
      { ic:"Truck",        label:"Rutas y entregas",     hint:"5 hoy" },
      { ic:"RefreshCw",    label:"Traslados",            hint:"2 activos" },
      { ic:"Package",      label:"Recepción de carga" },
      { ic:"Filter",       label:"Ajustes de inventario" },
    ]},
    { title:"Vista global", items:[
      { ic:"Building2",    label:"Stock por sucursal",   hint:"3 críticos" },
      { ic:"Activity",     label:"Kardex completo" },
    ]},
    { title:"Cuenta", items:[
      { ic:"Bell",         label:"Notificaciones",       hint:"3" },
      { ic:"ShieldCheck",  label:"Privacidad y seguridad" },
      { ic:"Settings",     label:"Ajustes" },
    ]},
  ],
  admin: [
    { title:"Negocio", items:[
      { ic:"Building2",    label:"Sucursales",           hint:"3" },
      { ic:"Users",        label:"Equipo global",        hint:"5" },
      { ic:"Activity",     label:"Reportes globales" },
      { ic:"PieChart",     label:"Indicadores financieros" },
    ]},
    { title:"Configuración", items:[
      { ic:"Tag",          label:"Catálogo y precios" },
      { ic:"Ticket",       label:"Cupones y promociones" },
      { ic:"ShieldCheck",  label:"Roles y permisos" },
      { ic:"Settings",     label:"Sistema y compliance" },
    ]},
    { title:"Cuenta", items:[
      { ic:"Bell",         label:"Notificaciones",       hint:"3" },
    ]},
  ],
};
window.ROLE_DRAWER_LINKS = ROLE_DRAWER_LINKS;
