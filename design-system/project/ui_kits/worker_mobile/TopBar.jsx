// TopBar — frosted sticky bar with avatar (role-aware), branch chip, notif bell.

function TopBar({ profile = PROFILE, role = "vendedor", branch, onOpenBranch, onOpenDrawer, onOpenNotifs, notifCount, registerOpen }) {
  const roleColor = {
    vendedor:  { dot: "#10b981", chip: "var(--sf-indigo-50)", chipFg: "var(--sf-indigo-700)" },
    jefe:      { dot: "#fbbf24", chip: "#fffbeb",              chipFg: "#92400e" },
    logistica: { dot: "#3b82f6", chip: "#eff6ff",              chipFg: "#1e40af" },
    admin:     { dot: "#a855f7", chip: "#faf5ff",              chipFg: "#6b21a8" },
  }[role] || { dot: "#10b981", chip: "var(--sf-indigo-50)", chipFg: "var(--sf-indigo-700)" };

  return (
    <div className="sf-topbar-frost" style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"12px 18px 12px",gap:10,
    }}>
      <button onClick={onOpenDrawer} className="sf-tap" style={{
        background:"none",border:"none",padding:0,cursor:"pointer",
        display:"flex",alignItems:"center",gap:10,flexShrink:0,minWidth:0,
      }}>
        <div style={{position:"relative",flexShrink:0}}>
          <Avatar initial={profile.initial} size={40} palette="indigoSolid" ring/>
          <div style={{
            position:"absolute",bottom:-2,right:-2,
            width:14,height:14,borderRadius:9999,
            background: registerOpen ? roleColor.dot : "#94a3b8",
            border:"2.5px solid white",
            boxShadow: registerOpen ? `0 0 0 3px ${roleColor.dot}33` : "none",
          }}/>
        </div>
        <div style={{textAlign:"left",lineHeight:1,minWidth:0,maxWidth:130}}>
          <div style={{
            font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            color: roleColor.chipFg, background: roleColor.chip,
            padding:"3px 7px",borderRadius:5,
            display:"inline-block",marginBottom:5,
          }}>{ROLE_LABELS[role]}</div>
          <div style={{font:"900 13px/1 Inter",color:"var(--sf-fg-1)",letterSpacing:"-0.015em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{profile.name.split(" ")[0]}</div>
        </div>
      </button>

      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <button onClick={onOpenBranch} className="sf-tap" style={{
          background:"white",border:"1px solid var(--sf-stroke-1)",
          borderRadius:12,padding:"8px 11px",display:"flex",alignItems:"center",gap:6,
          cursor:"pointer", boxShadow:"0 1px 2px rgba(15,23,42,0.04)",
        }}>
          <Icon name="Building2" size={13} style={{color:"var(--sf-indigo-600)"}} />
          <span style={{font:"900 10px/1 Inter",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--sf-fg-2)",whiteSpace:"nowrap"}}>{branch.name.replace("Sucursal ","")}</span>
          <Icon name="ChevronRight" size={11} style={{color:"var(--sf-fg-4)",transform:"rotate(90deg)"}} />
        </button>
        <button onClick={onOpenNotifs} className="sf-tap" style={{
          width:42,height:42,background:"white",border:"1px solid var(--sf-stroke-1)",
          borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
          color:"var(--sf-fg-2)",position:"relative",cursor:"pointer",
          boxShadow:"0 1px 2px rgba(15,23,42,0.04)",
        }}>
          <Icon name="Bell" size={17} />
          {notifCount > 0 && (
            <span style={{
              position:"absolute",top:6,right:6,
              minWidth:16,height:16,padding:"0 4px",borderRadius:9999,
              background:"linear-gradient(140deg,#e11d48,#f43f5e)",color:"white",
              font:"900 9px/16px Inter",textAlign:"center",
              border:"2px solid white",
              boxShadow:"0 2px 6px -2px rgba(244,63,94,0.55)",
            }}>{notifCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

window.TopBar = TopBar;
