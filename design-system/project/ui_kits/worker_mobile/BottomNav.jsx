// BottomNav — floating bottom navigation with center FAB.
// items: [tabA, tabB, null, tabC, tabD]  (null = FAB position)

function BottomNav({ items, active, onChange, onFab, fabIcon = "Zap", cartCount = 0 }) {
  return (
    <nav className="sf-bottom-nav">
      {items.map((it, i) => {
        if (!it) {
          return (
            <div key="fab" className="sf-nav-fab sf-tap" onClick={onFab} role="button" aria-label="Acción principal">
              <Icon name={fabIcon} size={24} fill={fabIcon === "Zap" ? "currentColor" : "none"} strokeWidth={fabIcon === "Zap" ? 0 : 2.5}/>
            </div>
          );
        }
        const isActive = active === it.id;
        const badge = it.badgeCart ? cartCount : 0;
        return (
          <div key={it.id} className={`sf-nav-item${isActive ? " active" : ""}`} onClick={() => onChange(it.id)} role="button">
            <div style={{position:"relative"}}>
              <Icon name={it.icon} size={20} strokeWidth={isActive ? 2.5 : 2}/>
              {badge > 0 && (
                <span style={{
                  position:"absolute",top:-4,right:-7,minWidth:16,height:16,padding:"0 4px",
                  background:"linear-gradient(140deg,#e11d48,#f43f5e)",color:"white",borderRadius:9999,
                  font:"900 9px/16px Inter",textAlign:"center",border:"2px solid white",
                  boxShadow:"0 2px 6px -2px rgba(244,63,94,0.55)",
                }}>{badge}</span>
              )}
            </div>
            <span className="label">{it.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

window.BottomNav = BottomNav;
