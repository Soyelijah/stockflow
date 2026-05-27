// App.jsx — role-aware orchestrator for the StockFlow worker mobile app.

function App() {
  const [authed, setAuthed] = React.useState(false);
  const [role, setRole] = React.useState("vendedor");
  const [tab, setTab] = React.useState("home");

  const [branch, setBranch] = React.useState(BRANCHES[0]);

  // Cart (vendedor only)
  const [cart, setCart] = React.useState([]);
  const [customer, setCustomer] = React.useState(null);

  // Shift state (vendedor only)
  const [shift, setShift] = React.useState({
    open: true, opening: 100000, openedAt: "08:30",
    salesTotal: 245890, salesCount: 12,
    byMethod: { efectivo: 48500, tarjeta: 112300, transferencia: 38240, digital: 46850 },
    retiros: [],
  });

  // Overlays
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [branchSheetOpen, setBranchSheetOpen] = React.useState(false);
  const [customerSheetOpen, setCustomerSheetOpen] = React.useState(false);
  const [shiftSheetOpen, setShiftSheetOpen] = React.useState(false);
  const [paymentOrder, setPaymentOrder] = React.useState(null);
  const [success, setSuccess] = React.useState(null);

  // Role-specific detail sheets
  const [approvalDetail, setApprovalDetail] = React.useState(null);
  const [deliveryDetail, setDeliveryDetail] = React.useState(null);
  const [branchDetail,   setBranchDetail]   = React.useState(null);
  const [userDetail,     setUserDetail]     = React.useState(null);

  // Identity from role
  const activeProfile = ROLE_PROFILES[role] || ROLE_PROFILES.vendedor;
  const profile = { ...activeProfile, branchLabel: branch.name };

  // Reset tab to home when role changes
  React.useEffect(() => { setTab("home"); }, [role]);

  // ===== Vendedor cart actions =====
  const addToCart = (p) => {
    if (p.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) return prev.map(i => i.id === p.id ? { ...i, qty: Math.min(p.stock, i.qty + 1) } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock }];
    });
  };
  const incCart = (p) => setCart(prev => prev.map(i => i.id === p.id ? { ...i, qty: Math.min(i.stock, i.qty + 1) } : i));
  const decCart = (p) => setCart(prev => prev.flatMap(i => i.id === p.id ? (i.qty === 1 ? [] : [{...i,qty:i.qty-1}]) : [i]));
  const removeCart = (p) => setCart(prev => prev.filter(i => i.id !== p.id));
  const clearCart = () => { setCart([]); setCustomer(null); };
  const cartCount = cart.reduce((s,i)=>s+i.qty,0);

  const startCheckout = (order) => setPaymentOrder(order);
  const finishCheckout = () => {
    const o = paymentOrder;
    setPaymentOrder(null);
    setSuccess(o);
    setShift(s => ({
      ...s,
      salesTotal: s.salesTotal + o.total,
      salesCount: s.salesCount + 1,
      byMethod: { ...s.byMethod, [o.paymentMethod]: (s.byMethod[o.paymentMethod] || 0) + o.total },
    }));
    clearCart();
  };
  const closeSuccess = () => setSuccess(null);

  const openShift = (amount) => {
    setShift({
      open: true, opening: amount,
      openedAt: new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}),
      salesTotal: 0, salesCount: 0,
      byMethod: { efectivo: 0, tarjeta: 0, transferencia: 0, digital: 0 },
      retiros: [],
    });
    setShiftSheetOpen(false);
  };
  const closeShift = () => setShift(s => ({ ...s, open: false }));

  // FAB action
  const onFab = () => {
    const cfg = ROLE_FAB[role];
    if (role === "vendedor") {
      if (cart.length > 0) setTab("cart"); else setTab("shop");
    } else if (cfg) {
      setTab(cfg.target);
    }
  };

  // Status bar tone
  React.useEffect(() => {
    const dark = !authed || !!paymentOrder;
    window.__setDark && window.__setDark(dark);
  }, [authed, paymentOrder]);

  if (!authed) return <LoginScreen onLogin={(r) => { setRole(r || "vendedor"); setAuthed(true); }} />;
  void success;

  // ===== Bottom nav config =====
  const tabs = ROLE_TABS[role] || ROLE_TABS.vendedor;
  // Insert FAB at position 2 (between 2nd and 3rd tab)
  const navItems = [tabs[0], tabs[1], null, tabs[2], tabs[3]];

  return (
    <div className="sf-app">
      <div className="sf-stage">
        <TopBar
          profile={profile}
          role={role}
          branch={branch}
          onOpenBranch={() => setBranchSheetOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenNotifs={() => setNotifOpen(true)}
          notifCount={NOTIFICATIONS.length}
          registerOpen={role === "vendedor" ? shift.open : true}
        />

        <div className="sf-scroll" key={`${role}-${tab}`}>
          {/* ===== VENDEDOR ===== */}
          {role === "vendedor" && tab === "home" && (
            <HomeTab shift={shift}
              onOpenShift={() => setShiftSheetOpen(true)} onCloseShift={closeShift}
              onScan={() => setTab("shop")} onCustomer={() => setCustomerSheetOpen(true)}
              onKardex={() => alert("Kardex próximamente")} onJumpTo={setTab}/>
          )}
          {role === "vendedor" && tab === "shop" && (
            <ShopTab products={PRODUCTS} cart={cart} onAdd={addToCart} onInc={incCart} onDec={decCart}
              onScan={() => alert("Lector de códigos · simulado")}/>
          )}
          {role === "vendedor" && tab === "cart" && (
            <CartTab cart={cart} customer={customer}
              onInc={incCart} onDec={decCart} onRemove={removeCart} onClear={clearCart}
              onPickCustomer={() => setCustomerSheetOpen(true)}
              registerOpen={shift.open} onCheckout={startCheckout}/>
          )}
          {role === "vendedor" && tab === "profile" && (
            <ProfileTab shift={shift}
              profile={profile}
              onOpenShift={() => setShiftSheetOpen(true)}
              onCloseShift={closeShift}
              onLogout={() => setAuthed(false)}/>
          )}

          {/* ===== JEFE ===== */}
          {role === "jefe" && tab === "home" && (
            <JefeHomeTab shift={shift} branch={branch} onJumpTo={setTab} onOpenApproval={setApprovalDetail}/>
          )}
          {role === "jefe" && tab === "team" && <TeamTab/>}
          {role === "jefe" && tab === "reports" && <ReportsTab scope="branch"/>}
          {role === "jefe" && tab === "profile" && (
            <RoleProfileTab profile={profile} role={role} onLogout={() => setAuthed(false)}/>
          )}

          {/* ===== LOGÍSTICA ===== */}
          {role === "logistica" && tab === "home"      && <LogisticsHomeTab branch={branch} onJumpTo={setTab} onOpenDelivery={setDeliveryDetail}/>}
          {role === "logistica" && tab === "transfers" && <TransfersTab/>}
          {role === "logistica" && tab === "kardex"    && <KardexTab/>}
          {role === "logistica" && tab === "profile"   && <RoleProfileTab profile={profile} role={role} onLogout={() => setAuthed(false)}/>}

          {/* ===== ADMIN ===== */}
          {role === "admin" && tab === "home"     && <AdminHomeTab onJumpTo={setTab}/>}
          {role === "admin" && tab === "branches" && <BranchesTab onOpenBranch={setBranchDetail}/>}
          {role === "admin" && tab === "users"    && <UsersTab onOpenUser={setUserDetail}/>}
          {role === "admin" && tab === "reports"  && <ReportsTab scope="global"/>}
          {role === "admin" && tab === "profile"  && <RoleProfileTab profile={profile} role={role} onLogout={() => setAuthed(false)}/>}

          <div style={{height: 110, flexShrink: 0}}/>
        </div>

        <BottomNav
          items={navItems} active={tab} onChange={setTab}
          onFab={onFab} fabIcon={ROLE_FAB[role]?.ic || "Zap"}
          cartCount={role === "vendedor" ? cartCount : 0}
        />
      </div>

      {/* Overlays */}
      <SideDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        branch={branch} onSwitchBranch={setBranch}
        onLogout={() => { setDrawerOpen(false); setAuthed(false); }}
        onJumpTo={setTab}
        profile={profile} role={role}
      />
      <NotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      <BranchSwitchSheet open={branchSheetOpen} onClose={() => setBranchSheetOpen(false)} branch={branch} onSwitch={setBranch}/>
      <CustomerSheet open={customerSheetOpen} onClose={() => setCustomerSheetOpen(false)}
        onPick={setCustomer} customer={customer}/>
      <ShiftOpenSheet open={shiftSheetOpen} onClose={() => setShiftSheetOpen(false)} onConfirm={openShift}/>
      <PaymentSheet open={!!paymentOrder} order={paymentOrder}
        onClose={() => setPaymentOrder(null)} onSuccess={finishCheckout}/>
      <SuccessSheet open={!!success} order={success} onClose={closeSuccess}/>

      {/* Role-specific detail sheets */}
      <ApprovalDetailSheet open={!!approvalDetail} approval={approvalDetail} onClose={() => setApprovalDetail(null)}/>
      <DeliveryDetailSheet open={!!deliveryDetail} delivery={deliveryDetail} onClose={() => setDeliveryDetail(null)}/>
      <BranchDetailSheet open={!!branchDetail} branch={branchDetail} onClose={() => setBranchDetail(null)}/>
      <UserDetailSheet open={!!userDetail} member={userDetail} onClose={() => setUserDetail(null)}/>
    </div>
  );
}

// Generic profile tab used by Jefe / Logística / Admin
function RoleProfileTab({ profile, role, onLogout }) {
  const stats = {
    jefe: [
      { lbl:"Sucursal a cargo", v:"Centro" },
      { lbl:"Personas",         v: TEAM_MEMBERS.length },
      { lbl:"Aprob. hoy",       v: 7 },
    ],
    logistica: [
      { lbl:"Entregas hoy",    v: DELIVERIES.length },
      { lbl:"Traslados",       v: TRANSFERS.length },
      { lbl:"Sucursales",      v: BRANCHES.length },
    ],
    admin: [
      { lbl:"Sucursales",      v: BRANCH_METRICS.length },
      { lbl:"Equipo total",    v: TEAM_MEMBERS.length },
      { lbl:"Ingresos hoy",    v: CLP(BRANCH_METRICS.reduce((s,b)=>s+b.sales,0)).replace(/\.000$/,"K") },
    ],
  }[role] || [];
  return (
    <div className="sf-tab-in" style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:16}}>
      <div className="sf-hero-card" style={{padding:"22px 22px 20px",borderRadius:28}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Avatar initial={profile.initial} size={62} palette="glass" ring/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:"900 19px/1.1 Inter",letterSpacing:"-0.02em",color:"white"}}>{profile.name}</div>
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <Pill kind="dark">{profile.roleLabel}</Pill>
              <Pill kind="dark"><Icon name="Building2" size={9}/> {profile.branchLabel?.replace("Sucursal ","") || ""}</Pill>
            </div>
            <div style={{font:"700 11px/1.2 Inter",color:"rgba(255,255,255,0.65)",marginTop:8,fontFamily:"ui-monospace,monospace"}}>{profile.email}</div>
          </div>
          <button onClick={onLogout} className="sf-tap" style={{
            width:40,height:40,borderRadius:13,background:"rgba(244,63,94,0.18)",color:"#fda4af",
            border:"1px solid rgba(244,63,94,0.22)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}><Icon name="LogOut" size={15}/></button>
        </div>

        {/* Stats strip in glass */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:18}}>
          {stats.map((s,i) => (
            <div key={i} className="sf-glass" style={{borderRadius:14,padding:"10px 12px"}}>
              <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.55)"}}>{s.lbl}</div>
              <div style={{font:"900 14px/1 Inter",color:"white",marginTop:6,letterSpacing:"-0.02em"}} className="sf-tnum">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions card */}
      <div className="sf-card-soft" style={{padding:18}}>
        <div style={{font:"900 11px/1 Inter",color:"var(--sf-fg-1)",marginBottom:5}}>Mis permisos</div>
        <div style={{font:"700 10px/1.3 Inter",color:"var(--sf-fg-4)",marginBottom:14}}>Lo que puedes hacer con este rol</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ROLE_PERMISSIONS[role].map((p, i) => (
            <PermissionRow key={i} {...p}/>
          ))}
        </div>
      </div>

      <button onClick={onLogout} className="sf-tap" style={{
        width:"100%",height:50,borderRadius:14,
        background:"rgba(244,63,94,0.10)",border:"1px solid rgba(244,63,94,0.20)",color:"var(--sf-danger)",
        font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",
      }}>
        <Icon name="LogOut" size={14}/> Cambiar de usuario
      </button>
    </div>
  );
}

function PermissionRow({ ic, label, allowed }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"6px 4px"}}>
      <IconChip name={ic} palette={allowed?"emerald":"slate"} size={32} icSize={14}/>
      <span style={{flex:1,font:"700 12px/1.2 Inter",color:allowed?"var(--sf-fg-1)":"var(--sf-fg-4)"}}>{label}</span>
      {allowed
        ? <Icon name="Check" size={14} strokeWidth={3} style={{color:"var(--sf-success)"}}/>
        : <Icon name="X"     size={14} strokeWidth={3} style={{color:"var(--sf-fg-4)"}}/>}
    </div>
  );
}

const ROLE_PERMISSIONS = {
  vendedor: [
    { ic:"ShoppingCart", label:"Procesar ventas (POS)",        allowed:true },
    { ic:"Receipt",      label:"Emitir boleta y factura",      allowed:true },
    { ic:"Users",        label:"Crear clientes",               allowed:true },
    { ic:"Unlock",       label:"Abrir y cerrar mi turno",      allowed:true },
    { ic:"RefreshCw",    label:"Aprobar devoluciones",         allowed:false },
    { ic:"Building2",    label:"Cambiar de sucursal",          allowed:false },
    { ic:"Users",        label:"Ver equipo completo",          allowed:false },
    { ic:"Settings",     label:"Configurar el sistema",        allowed:false },
  ],
  jefe: [
    { ic:"PieChart",     label:"Ver resumen de la sucursal",   allowed:true },
    { ic:"Users",        label:"Gestionar vendedores",         allowed:true },
    { ic:"CheckCircle2", label:"Aprobar devoluciones y dctos.", allowed:true },
    { ic:"Lock",         label:"Cerrar caja del local",        allowed:true },
    { ic:"Activity",     label:"Ver reportes diarios y semanales", allowed:true },
    { ic:"ShoppingCart", label:"Procesar ventas (si necesario)", allowed:true },
    { ic:"Building2",    label:"Ver otras sucursales",         allowed:false },
    { ic:"Settings",     label:"Configurar el sistema",        allowed:false },
  ],
  logistica: [
    { ic:"Truck",        label:"Gestionar rutas y entregas",   allowed:true },
    { ic:"RefreshCw",    label:"Traslados entre sucursales",   allowed:true },
    { ic:"Package",      label:"Recibir mercadería",           allowed:true },
    { ic:"Filter",       label:"Ajustar inventario",           allowed:true },
    { ic:"Building2",    label:"Ver stock de todas las sucursales", allowed:true },
    { ic:"ShoppingCart", label:"Procesar ventas",              allowed:false },
    { ic:"Users",        label:"Gestionar equipo de ventas",   allowed:false },
    { ic:"Settings",     label:"Configurar el sistema",        allowed:false },
  ],
  admin: [
    { ic:"ShieldCheck",  label:"Acceso total al sistema",      allowed:true },
    { ic:"Building2",    label:"Crear y editar sucursales",    allowed:true },
    { ic:"Users",        label:"Gestionar todos los usuarios", allowed:true },
    { ic:"Activity",     label:"Reportes globales",            allowed:true },
    { ic:"Settings",     label:"Configuración del sistema",    allowed:true },
    { ic:"Tag",          label:"Definir cupones y precios",    allowed:true },
    { ic:"ShoppingCart", label:"Procesar ventas (POS)",        allowed:true },
    { ic:"Truck",        label:"Operaciones logísticas",       allowed:true },
  ],
};

window.App = App;
window.RoleProfileTab = RoleProfileTab;
