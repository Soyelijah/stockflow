// Login — premium SF Staff: gradient mesh, role chip, biometric, animated wordmark.

function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState("m.gonzalez@stockflow.com");
  const [password, setPassword] = React.useState("worker123");
  const [showPwd, setShowPwd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [role, setRole] = React.useState("vendedor"); // vendedor | jefe | logistica | admin
  const [remember, setRemember] = React.useState(true);

  // Auto-fill email per role so user can see who they're logging in as
  React.useEffect(() => {
    const p = ROLE_PROFILES[role];
    if (p) setEmail(p.email);
  }, [role]);

  const submit = (e) => {
    e?.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); onLogin(role); }, 900);
  };

  const wordmark = "StockFlow".split("");

  return (
    <div style={{
      position:"absolute",inset:0,
      background:
        "radial-gradient(120% 60% at 50% -10%, #4338ca 0%, transparent 55%)," +
        "radial-gradient(80% 50% at -10% 30%, rgba(168,85,247,0.4) 0%, transparent 65%)," +
        "radial-gradient(80% 50% at 110% 70%, rgba(99,102,241,0.5) 0%, transparent 65%)," +
        "linear-gradient(180deg, #1e1b4b 0%, #0f172a 60%, #060608 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"Inter,system-ui,sans-serif",
      overflow:"hidden",
    }}>
      {/* Animated blob */}
      <div style={{
        position:"absolute",top:"-10%",left:"50%",transform:"translateX(-50%)",
        width:480,height:480,borderRadius:"50%",
        background:"radial-gradient(closest-side, rgba(99,102,241,0.45), transparent 70%)",
        filter:"blur(60px)",animation:"sf-ambient 14s ease-in-out infinite",pointerEvents:"none",
      }}/>
      {/* Grain */}
      <div style={{
        position:"absolute",inset:0,
        backgroundImage:"radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize:"14px 14px",
        opacity:0.5,mixBlendMode:"overlay",pointerEvents:"none",
      }}/>

      <div style={{width:"100%",maxWidth:360,padding:"0 28px",position:"relative",zIndex:2,display:"flex",flexDirection:"column",gap:16}}>
        {/* Brand */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,marginBottom:4}}>
          <div className="sf-float" style={{
            position:"relative",
            width:66,height:66,borderRadius:22,
            background:"linear-gradient(140deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:
              "0 18px 40px -10px rgba(79,70,229,0.6), " +
              "0 0 0 1px rgba(255,255,255,0.10), " +
              "inset 0 1px 0 rgba(255,255,255,0.22)",
            color:"white",
          }}>
            <div style={{
              position:"absolute",inset:-12,borderRadius:30,
              background:"radial-gradient(closest-side, rgba(99,102,241,0.55), transparent 70%)",
              filter:"blur(8px)",pointerEvents:"none",zIndex:-1,
            }}/>
            <Icon name="Zap" size={32} fill="currentColor" strokeWidth={0}/>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:8}}>
              <h1 style={{font:"900 30px/1 Inter",letterSpacing:"-0.025em",color:"white",margin:0}}>
                {wordmark.map((ch, i) => (
                  <span key={i} className="sf-letter" style={{animationDelay: `${100 + i * 50}ms`}}>{ch}</span>
                ))}
              </h1>
              <span style={{font:"700 10px/1 ui-monospace,monospace",color:"#a5b4fc",animation:"sf-letter-in 600ms 0.7s var(--sf-spring) both"}}>v2.1</span>
            </div>
            <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.24em",color:"#6366f1",marginTop:10,animation:"sf-item-in 500ms 0.8s var(--sf-spring) both"}}>
              App de Trabajadores
            </div>
          </div>
        </div>

        {/* Role chips — 4 roles */}
        <div style={{
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,padding:4,background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,
        }}>
          {[
            { id:"vendedor",  label:"Vendedor",  ic:"User" },
            { id:"jefe",      label:"Jefe",      ic:"Star" },
            { id:"logistica", label:"Logística", ic:"Truck" },
            { id:"admin",     label:"Admin",     ic:"ShieldCheck" },
          ].map(r => {
            const active = r.id === role;
            return (
              <button key={r.id} onClick={() => setRole(r.id)} className="sf-tap" style={{
                padding:"10px 4px",borderRadius:10,
                background: active ? "linear-gradient(140deg,rgba(99,102,241,0.30),rgba(79,70,229,0.20))" : "transparent",
                border: active ? "1px solid rgba(99,102,241,0.40)" : "1px solid transparent",
                color: active ? "white" : "rgba(255,255,255,0.5)",
                font:"900 8.5px/1 Inter",textTransform:"uppercase",letterSpacing:"0.10em",
                cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,
                boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.10)" : "none",
              }}>
                <Icon name={r.ic} size={14} strokeWidth={2.5}/>
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Card */}
        <div className="sf-glass-strong" style={{
          borderRadius:26,padding:22,position:"relative",overflow:"hidden",
          animation:"sf-item-in 500ms 1.0s var(--sf-spring) both",
        }}>
          {/* top accent stripe */}
          <div style={{
            position:"absolute",top:0,left:24,right:24,height:2,
            background:"linear-gradient(to right, transparent, #818cf8, transparent)",
            opacity:0.8,
          }}/>

          <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
            <LoginField label="Correo electrónico" icon="Mail">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="tu@stockflow.com" style={loginInputStyle}/>
            </LoginField>
            <LoginField label="Contraseña" icon="Lock" right={
              <button type="button" onClick={() => setShowPwd(s=>!s)} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:6}}>
                <Icon name={showPwd ? "EyeOff" : "Eye"} size={14}/>
              </button>
            }>
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPwd?"text":"password"}
                style={loginInputStyle}/>
            </LoginField>

            {/* Remember + forgot */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 4px"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
                <span style={{
                  width:18,height:18,borderRadius:6,
                  background: remember ? "linear-gradient(140deg,#4f46e5,#6366f1)" : "rgba(255,255,255,0.04)",
                  border: remember ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.10)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all 200ms var(--sf-spring)",
                  boxShadow: remember ? "0 4px 10px -2px rgba(79,70,229,0.45)" : "none",
                }} onClick={() => setRemember(r => !r)}>
                  {remember && <Icon name="Check" size={11} strokeWidth={3.5} style={{color:"white"}}/>}
                </span>
                <span style={{font:"800 10px/1 Inter",color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.12em"}}>Recordar</span>
              </label>
              <button type="button" style={{background:"none",border:"none",color:"#a5b4fc",cursor:"pointer",
                font:"800 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",
              }}>¿Olvidaste?</button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={busy} className="sf-tap" style={{
              width:"100%",height:54,marginTop:4,
              background:"linear-gradient(140deg,#4f46e5,#6366f1)",color:"white",
              border:"none",borderRadius:16,
              font:"900 12px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              boxShadow:"0 18px 36px -10px rgba(79,70,229,0.55), 0 4px 10px -2px rgba(79,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.18)",
              opacity: busy ? 0.7 : 1,position:"relative",overflow:"hidden",
            }}>
              {/* shimmer */}
              <div style={{position:"absolute",inset:0,background:"linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.20) 50%,transparent 70%)",transform: busy ? "translateX(0)" : "translateX(-100%)",animation: busy ? "sf-shimmer 1.6s linear infinite" : "none",pointerEvents:"none"}}/>
              {busy ? <div style={{width:18,height:18,border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"sf-spin 0.9s linear infinite"}}/> :
                <><span style={{whiteSpace:"nowrap"}}>Iniciar sesión</span><Icon name="ChevronRight" size={15} strokeWidth={3}/></>}
            </button>

            {/* OR divider */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:2}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
              <span style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.2em",color:"rgba(255,255,255,0.35)"}}>o continúa con</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
            </div>

            {/* Biometric / SSO */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button type="button" className="sf-tap" style={authChip}>
                <Icon name="Smartphone" size={14}/>
                <span>Face ID</span>
              </button>
              <button type="button" className="sf-tap" style={authChip}>
                <Icon name="ShieldCheck" size={14}/>
                <span>SSO empresa</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"4px 8px",animation:"sf-item-in 500ms 1.2s var(--sf-spring) both",
        }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,font:"800 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.35)"}}>
            <Icon name="ShieldCheck" size={11} style={{color:"#34d399"}}/> SSL · PCI‑DSS v4.0
          </span>
          <span style={{font:"800 9px/1 ui-monospace,monospace",color:"rgba(255,255,255,0.25)"}}>build 8421</span>
        </div>

        <div style={{textAlign:"center",font:"700 10px/1.5 Inter",color:"rgba(255,255,255,0.40)",marginTop:2}}>
          ¿Cliente o repartidor? <span style={{color:"#a5b4fc",fontWeight:900}}>Descarga la app correspondiente</span>
        </div>
      </div>
    </div>
  );
}

const loginInputStyle = {
  width:"100%",height:46,
  background:"rgba(15,23,42,0.45)",
  border:"1px solid rgba(255,255,255,0.08)",
  borderRadius:13,padding:"0 14px 0 40px",color:"white",
  font:"700 13px/1 Inter",outline:"none",boxSizing:"border-box",
};

const authChip = {
  height:44,background:"rgba(15,23,42,0.45)",border:"1px solid rgba(255,255,255,0.08)",
  color:"rgba(255,255,255,0.85)",borderRadius:13,cursor:"pointer",
  font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.12em",
  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
};

function LoginField({ label, icon, right, children }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,paddingLeft:4}}>
        <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.18em",color:"rgba(255,255,255,0.55)"}}>{label}</span>
        {right}
      </div>
      <div style={{position:"relative"}}>
        <Icon name={icon} size={15} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#6366f1",pointerEvents:"none"}}/>
        {children}
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
