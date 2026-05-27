// Shared atoms: Pill, IconChip, ProgressRing, MoneyTicker, Avatar, Sparkline, MiniStat

function Pill({ children, kind = "neutral", pulse = false, style = {} }) {
  return <span className={`sf-pill-base sf-pill-${kind} ${pulse ? "sf-pulse" : ""}`} style={style}>{children}</span>;
}

function IconChip({ name, palette = "indigo", size = 40, icSize, style = {} }) {
  const p = {
    indigo:      { bg: "var(--sf-indigo-50)",   fg: "var(--sf-indigo-600)" },
    indigoSolid: { bg: "linear-gradient(140deg,#4f46e5,#6366f1)", fg: "white" },
    emerald:     { bg: "var(--sf-success-bg)",  fg: "var(--sf-success)" },
    emeraldSolid:{ bg: "linear-gradient(140deg,#059669,#10b981)", fg: "white" },
    amber:       { bg: "var(--sf-warning-bg)",  fg: "var(--sf-warning)" },
    amberSolid:  { bg: "linear-gradient(140deg,#d97706,#f59e0b)", fg: "white" },
    rose:        { bg: "var(--sf-danger-bg)",   fg: "var(--sf-danger)" },
    roseSolid:   { bg: "linear-gradient(140deg,#e11d48,#f43f5e)", fg: "white" },
    blue:        { bg: "var(--sf-info-bg)",     fg: "var(--sf-info)" },
    blueSolid:   { bg: "linear-gradient(140deg,#2563eb,#3b82f6)", fg: "white" },
    purple:      { bg: "var(--sf-customer-bg)", fg: "var(--sf-customer)" },
    purpleSolid: { bg: "linear-gradient(140deg,#9333ea,#a855f7)", fg: "white" },
    slate:       { bg: "var(--sf-slate-50)",    fg: "var(--sf-slate-500)" },
    dark:        { bg: "linear-gradient(140deg,#1e293b,#0f172a)", fg: "white" },
    glass:       { bg: "rgba(255,255,255,0.10)", fg: "white" },
  }[palette] || { bg: "var(--sf-slate-50)", fg: "var(--sf-slate-500)" };
  const isSolid = palette.endsWith("Solid") || palette === "dark";
  const tintMap = {
    indigoSolid: "rgba(79,70,229,0.45)", emeraldSolid: "rgba(16,185,129,0.45)",
    amberSolid: "rgba(245,158,11,0.45)", roseSolid: "rgba(244,63,94,0.45)",
    blueSolid: "rgba(59,130,246,0.45)", purpleSolid: "rgba(168,85,247,0.45)",
    dark: "rgba(15,23,42,0.45)",
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: p.bg, color: p.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: isSolid ? `0 8px 18px -8px ${tintMap[palette] || "rgba(0,0,0,0.3)"}, inset 0 1px 0 rgba(255,255,255,0.18)` : "none",
      flexShrink: 0,
      ...style,
    }}>
      <Icon name={name} size={icSize || Math.round(size * 0.5)} strokeWidth={2.2} />
    </div>
  );
}

function ProgressRing({ size = 56, stroke = 5, progress = 0.5, fg = "white", bg = "rgba(255,255,255,0.18)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [animOff, setAnimOff] = React.useState(c); // start empty
  React.useEffect(() => {
    const id = setTimeout(() => setAnimOff(c * (1 - progress)), 20);
    return () => clearTimeout(id);
  }, [progress, c]);
  return (
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{transform: "rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fg} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={animOff} strokeLinecap="round"
          style={{transition: "stroke-dashoffset 1.4s var(--sf-spring)"}} />
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</div>
    </div>
  );
}

function Avatar({ initial = "?", size = 36, palette = "indigoSolid", ring = false }) {
  const p = {
    indigoSolid: { bg: "linear-gradient(140deg,#4f46e5,#6366f1)", fg: "white", glow: "rgba(79,70,229,0.45)" },
    glass:       { bg: "rgba(255,255,255,0.10)", fg: "white", border: "1px solid rgba(255,255,255,0.18)" },
    slate:       { bg: "var(--sf-slate-100)", fg: "var(--sf-fg-2)" },
    purpleSolid: { bg: "linear-gradient(140deg,#9333ea,#a855f7)", fg: "white", glow: "rgba(168,85,247,0.40)" },
  }[palette];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.34,
      background: p.bg, color: p.fg, border: p.border || (ring ? `2px solid rgba(255,255,255,0.85)` : "none"),
      display:"flex",alignItems:"center",justifyContent:"center",
      font: `900 ${Math.round(size * 0.42)}px/1 Inter, sans-serif`,
      letterSpacing: "-0.02em", flexShrink: 0,
      boxShadow: p.glow ? `0 6px 16px -4px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.20)` : "none",
    }}>{initial}</div>
  );
}

// Money ticker — counts up on mount via setInterval (simpler than rAF, more robust).
function MoneyTicker({ value, duration = 800, prefix = "$", animate = false, className = "", style = {} }) {
  const [n, setN] = React.useState(animate ? 0 : value);
  const lastValueRef = React.useRef(animate ? 0 : value);
  React.useEffect(() => {
    if (!animate) { setN(value); return; }
    if (value < 5000) { setN(value); return; }
    const from = lastValueRef.current;
    if (from === value) return;
    lastValueRef.current = value;
    const steps = 30;
    const stepMs = duration / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      const eased = 1 - Math.pow(1 - t, 4);
      setN(Math.round(from + (value - from) * eased));
      if (i >= steps) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [value, duration, animate]);
  return <span className={className + " sf-tnum"} style={style}>{prefix}{n.toLocaleString("es-CL")}</span>;
}

// Sparkline bars — used in hero & stat cards
function Sparkline({ data, height = 32, gap = 3, color = "var(--sf-indigo-600)", muted = false, labelKey = "h", labelEvery = 2 }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap,height,width:"100%"}}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.v / max) * height);
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div className="sf-bar" style={{
              width:"100%",height: h,
              background: muted ? "rgba(255,255,255,0.40)" : `linear-gradient(180deg, ${color === "white" ? "rgba(255,255,255,0.95)" : "var(--sf-indigo-400)"}, ${color === "white" ? "rgba(255,255,255,0.55)" : color})`,
              borderRadius:"4px 4px 0 0",
              animationDelay: `${i * 35}ms`,
              opacity: muted ? 0.7 : 1,
            }}/>
          </div>
        );
      })}
    </div>
  );
}

// Stat tile with optional sparkline
function StatTile({ label, value, delta, deltaPositive, sparkData, icon, palette = "indigo" }) {
  const deltaColor = deltaPositive ? "var(--sf-success)" : "var(--sf-danger)";
  return (
    <div className="sf-card-soft sf-press" style={{padding:14,display:"flex",flexDirection:"column",gap:8,position:"relative",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{font:"900 8px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>{label}</div>
          <div style={{font:"900 18px/1 Inter",color:"var(--sf-fg-1)",marginTop:7,letterSpacing:"-0.02em"}} className="sf-tnum">{value}</div>
        </div>
        {icon && <IconChip name={icon} palette={palette} size={30} icSize={14}/>}
      </div>
      {delta != null && (
        <div style={{display:"flex",alignItems:"center",gap:4,font:"900 9px/1 Inter",color:deltaColor}}>
          <Icon name={deltaPositive ? "TrendingUp" : "TrendingUp"} size={11} strokeWidth={2.5} style={{transform: deltaPositive ? "none" : "rotate(180deg)"}}/>
          <span>{delta}</span>
        </div>
      )}
      {sparkData && <div style={{marginTop:2}}><Sparkline data={sparkData} height={22} gap={2}/></div>}
    </div>
  );
}

function Divider({ dark = false }) {
  return <div style={{height:1,background:dark?"rgba(255,255,255,0.08)":"var(--sf-stroke-1)",margin:"4px 0"}}/>;
}

Object.assign(window, { Pill, IconChip, ProgressRing, Avatar, MoneyTicker, Sparkline, StatTile, Divider });
