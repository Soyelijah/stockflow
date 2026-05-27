// PaymentSheet — full-screen dark payment simulation (NFC / QR) + Success screen.

function PaymentSheet({ open, order, onClose, onSuccess }) {
  const [stage, setStage] = React.useState("ready"); // ready | processing | success
  const [step, setStep]   = React.useState(0);
  const [show, setShow]   = React.useState(false);

  // Reset when reopened
  React.useEffect(() => {
    if (open) {
      setStage("ready"); setStep(0); setShow(false);
      const id = setTimeout(() => setShow(true), 20);
      return () => clearTimeout(id);
    }
  }, [open]);

  if (!open || !order) return null;
  const isNFC = order.paymentMethod === "tarjeta";
  const isQR  = order.paymentMethod === "digital";
  const isInstant = !isNFC && !isQR; // efectivo / transferencia → confirm directly

  const cardSteps = [
    "Lectura NFC correcta · obteniendo credenciales…",
    "Cifrando transacción con clave de sesión (Tokenización)…",
    "Solicitando autorización con red bancaria (Transbank)…",
    "¡PAGO AUTORIZADO!",
  ];
  const qrSteps = [
    "QR Escaneado · cargando datos de billetera…",
    "Conectando con API · verificando balance…",
    "Confirmando transferencia a cuenta comercio…",
    "¡PAGO AUTORIZADO!",
  ];
  const steps = isNFC ? cardSteps : qrSteps;

  const start = () => {
    if (isInstant) { setStage("success"); setTimeout(onSuccess, 1100); return; }
    setStage("processing"); setStep(0);
    const advance = (i) => {
      if (i >= steps.length - 1) {
        setStep(i); setStage("success");
        setTimeout(onSuccess, 1100);
        return;
      }
      setStep(i);
      setTimeout(() => advance(i+1), 900);
    };
    advance(0);
  };

  return (
    <div style={{
      position:"absolute",inset:0,zIndex:100,
      background:"radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #0f172a 50%, #060608 100%)",
      color:"white",display:"flex",flexDirection:"column",
      transform: show ? "translateY(0)" : "translateY(100%)",
      transition: "transform 420ms var(--sf-spring)",
    }}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px"}}>
        <button onClick={onClose} className="sf-tap" style={{
          width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.06)",
          color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
        }}><Icon name="X" size={16}/></button>
        <div style={{textAlign:"center",minWidth:0}}>
          <div style={{font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap"}}>
            {isNFC?"Pago con tarjeta":isQR?"Pago con QR":order.paymentMethod === "efectivo"?"Pago en efectivo":"Pago por transferencia"}
          </div>
          <div style={{font:"900 11px/1 Inter",color:"white",marginTop:6,textTransform:"uppercase",letterSpacing:"0.16em",opacity:0.85}}>{order.docType}</div>
        </div>
        <div style={{
          width:36,height:36,borderRadius:12,background:"rgba(16,185,129,0.18)",
          color:"#34d399",display:"flex",alignItems:"center",justifyContent:"center",
          border:"1px solid rgba(16,185,129,0.25)",
        }}><Icon name="ShieldCheck" size={16}/></div>
      </div>

      {/* Amount */}
      <div style={{textAlign:"center",padding:"18px 20px 0"}}>
        <div style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.2em",color:"rgba(255,255,255,0.5)"}}>Total a cobrar</div>
        <div style={{font:"900 48px/1 Inter",letterSpacing:"-0.03em",marginTop:14,fontVariantNumeric:"tabular-nums"}}>{CLP(order.total)}</div>
        {order.customer && (
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:9999,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",marginTop:14}}>
            <Avatar initial={order.customer.name.charAt(0)} size={22} palette="glass"/>
            <span style={{font:"800 11px/1 Inter"}}>{order.customer.name}</span>
          </div>
        )}
      </div>

      {/* Stage UI */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
        {isNFC && <NFCVisual stage={stage} />}
        {isQR && <QRVisual stage={stage} />}
        {isInstant && <InstantVisual stage={stage} method={order.paymentMethod}/>}

        {/* Step text */}
        <div style={{marginTop:24,minHeight:48,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {stage === "ready" && (
            <div style={{font:"800 13px/1.4 Inter",color:"rgba(255,255,255,0.65)",textAlign:"center",maxWidth:260}}>
              {isNFC && "Acerque o inserte la tarjeta en el terminal."}
              {isQR  && "Pide al cliente que escanee este QR con su billetera virtual."}
              {order.paymentMethod === "efectivo" && "Cuenta el efectivo y confirma para registrar la venta."}
              {order.paymentMethod === "transferencia" && "Confirma la transferencia recibida para registrar la venta."}
            </div>
          )}
          {stage === "processing" && (
            <div style={{
              display:"inline-flex",alignItems:"center",gap:10,
              padding:"10px 16px",borderRadius:9999,
              background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"white",borderRadius:"50%",animation:"sf-spin 0.9s linear infinite"}}/>
              <span style={{font:"800 11px/1.2 Inter",color:"white"}}>{steps[step]}</span>
            </div>
          )}
          {stage === "success" && (
            <div style={{
              display:"inline-flex",alignItems:"center",gap:10,
              padding:"10px 16px",borderRadius:9999,
              background:"rgba(16,185,129,0.18)",border:"1px solid rgba(16,185,129,0.3)",color:"#34d399",
            }}>
              <Icon name="CheckCircle2" size={16}/>
              <span style={{font:"900 11px/1.2 Inter",textTransform:"uppercase",letterSpacing:"0.14em"}}>Pago autorizado</span>
            </div>
          )}
        </div>

        {/* Compliance */}
        <div style={{marginTop:14,font:"700 9px/1.4 Inter",textTransform:"uppercase",letterSpacing:"0.16em",color:"rgba(255,255,255,0.3)",textAlign:"center"}}>
          <Icon name="Lock" size={10} style={{verticalAlign:"middle",marginRight:6}}/> Procesa transacciones bajo normativa PCI‑DSS v4.0
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{padding:"0 20px 24px"}}>
        {stage === "ready" && (
          <button onClick={start} className="sf-tap" style={{
            width:"100%",height:60,background:"white",color:"var(--sf-slate-900)",
            border:"none",borderRadius:18,cursor:"pointer",
            font:"900 12px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            boxShadow:"0 12px 28px -8px rgba(255,255,255,0.25)",
          }}>
            <Icon name={isNFC?"CreditCard":isQR?"Smartphone":order.paymentMethod==="efectivo"?"Banknote":"RefreshCw"} size={16}/>
            {isNFC && "Simular acercar tarjeta (NFC)"}
            {isQR  && "Simular escaneo QR del cliente"}
            {order.paymentMethod === "efectivo" && "Confirmar efectivo recibido"}
            {order.paymentMethod === "transferencia" && "Confirmar transferencia"}
          </button>
        )}
      </div>
    </div>
  );
}

function NFCVisual({ stage }) {
  return (
    <div style={{position:"relative",width:200,height:140,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {/* Pulse rings */}
      {stage === "ready" && (
        <>
          <div className="sf-ping" style={{position:"absolute",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(99,102,241,0.5)"}}/>
          <div className="sf-ping" style={{position:"absolute",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(99,102,241,0.5)",animationDelay:"0.4s"}}/>
        </>
      )}
      {stage === "success" ? (
        <div style={{
          width:96,height:96,borderRadius:32,background:"rgba(16,185,129,0.18)",
          border:"1px solid rgba(16,185,129,0.3)",color:"#34d399",
          display:"flex",alignItems:"center",justifyContent:"center",
        }} className="sf-item-in">
          <Icon name="CheckCircle2" size={56}/>
        </div>
      ) : (
        <div style={{
          width:130,height:88,borderRadius:14,
          background:"linear-gradient(140deg,#1e1b4b 0%, #4338ca 60%, #6366f1 100%)",
          color:"white",display:"flex",alignItems:"center",justifyContent:"center",
          position:"relative",overflow:"hidden",
          boxShadow:"0 16px 30px -8px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}>
          {/* Chip */}
          <div style={{position:"absolute",top:14,left:14,width:24,height:18,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",borderRadius:4}}/>
          {/* NFC arc */}
          <Icon name="Wifi" size={22} style={{position:"absolute",top:14,right:14,transform:"rotate(90deg)"}}/>
          {/* Card number */}
          <div style={{position:"absolute",bottom:12,left:14,font:"900 9px/1 ui-monospace,monospace",color:"rgba(255,255,255,0.8)",letterSpacing:"0.15em"}}>**** 4291</div>
        </div>
      )}
    </div>
  );
}

function QRVisual({ stage }) {
  return (
    <div style={{
      width:180,height:180,background:"white",borderRadius:24,padding:14,
      position:"relative",overflow:"hidden",
      boxShadow:"0 20px 40px -10px rgba(0,0,0,0.5)",
    }}>
      {stage === "ready" && (
        <div style={{
          position:"absolute",left:14,right:14,height:2,
          background:"linear-gradient(to right, transparent, #6366f1, transparent)",
          boxShadow:"0 0 12px #6366f1",
          animation:"sf-laser 2.2s ease-in-out infinite",
        }}/>
      )}
      {stage === "success" ? (
        <div style={{position:"absolute",inset:14,background:"rgba(16,185,129,0.1)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon name="CheckCircle2" size={64} style={{color:"#059669"}}/>
        </div>
      ) : (
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{color:"#0f172a"}}>
          <rect x="5" y="5" width="22" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="5"/>
          <rect x="11" y="11" width="10" height="10" fill="currentColor"/>
          <rect x="73" y="5" width="22" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="5"/>
          <rect x="79" y="11" width="10" height="10" fill="currentColor"/>
          <rect x="5" y="73" width="22" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="5"/>
          <rect x="11" y="79" width="10" height="10" fill="currentColor"/>
          <path fill="currentColor" d="M40,10 h6 v6 h-6 z M52,10 h6 v6 h-6 z M40,22 h4 v6 h-4 z M54,22 h4 v6 h-4 z M64,10 h4 v8 h-4 z M40,34 h10 v4 h-10 z M60,30 h8 v8 h-8 z M30,42 h6 v8 h-6 z M44,44 h12 v6 h-12 z M60,50 h6 v4 h-6 z M76,42 h8 v6 h-8 z M86,40 h4 v8 h-4 z M40,60 h6 v4 h-6 z M52,58 h12 v6 h-12 z M70,60 h4 v6 h-4 z M80,62 h10 v6 h-10 z M40,74 h6 v6 h-6 z M52,70 h6 v10 h-6 z M64,74 h6 v6 h-6 z M76,70 h6 v8 h-6 z M84,80 h6 v6 h-6 z"/>
          <rect x="42" y="42" width="16" height="16" rx="3" fill="#4f46e5"/>
          <path d="M50 47 L52 51 L54 47" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      )}
      <style>{`@keyframes sf-laser { 0%{top:14px} 50%{top:160px} 100%{top:14px} }`}</style>
    </div>
  );
}

function InstantVisual({ stage, method }) {
  const ic = method === "efectivo" ? "Banknote" : "RefreshCw";
  const tint = method === "efectivo" ? "#10b981" : "#f59e0b";
  return (
    <div style={{position:"relative",width:140,height:140,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {stage === "success" ? (
        <div style={{
          width:96,height:96,borderRadius:32,background:"rgba(16,185,129,0.18)",
          border:"1px solid rgba(16,185,129,0.3)",color:"#34d399",
          display:"flex",alignItems:"center",justifyContent:"center",
        }} className="sf-item-in">
          <Icon name="CheckCircle2" size={56}/>
        </div>
      ) : (
        <div style={{
          width:104,height:104,borderRadius:30,
          background:`radial-gradient(closest-side, ${tint}30, transparent 70%)`,
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>
          <div style={{
            width:72,height:72,borderRadius:22,
            background:`linear-gradient(140deg,${tint},${tint}cc)`,
            display:"flex",alignItems:"center",justifyContent:"center",color:"white",
            boxShadow:`0 14px 28px -8px ${tint}80`,
          }}>
            <Icon name={ic} size={32}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- SuccessSheet ----------
function SuccessSheet({ open, order, onClose }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setShow(false);
      const id = setTimeout(() => setShow(true), 20);
      return () => clearTimeout(id);
    }
  }, [open]);
  if (!open || !order) return null;

  return (
    <div style={{
      position:"absolute",inset:0,zIndex:110,background:"white",display:"flex",flexDirection:"column",
      transform: show ? "translateY(0)" : "translateY(100%)",
      transition: "transform 460ms var(--sf-spring)",
    }}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px",textAlign:"center"}}>
        <div style={{
          width:96,height:96,borderRadius:32,
          background:"linear-gradient(140deg,#10b981,#059669)",color:"white",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 20px 40px -10px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.20)",
        }}>
          <Icon name="Check" size={48} strokeWidth={3}/>
        </div>
        <h2 style={{font:"900 26px/1 Inter",letterSpacing:"-0.025em",color:"var(--sf-fg-1)",margin:"24px 0 8px"}}>¡Venta registrada!</h2>
        <p style={{font:"600 12px/1.5 Inter",color:"var(--sf-fg-3)",maxWidth:280,margin:0}}>
          Se imprimió la {order.docType} y se descontó el stock en la sucursal.
        </p>

        <div className="sf-card-soft" style={{padding:18,marginTop:24,width:"100%",display:"flex",flexDirection:"column",gap:10}}>
          <Row k="Total cobrado" v={CLP(order.total)} bigV/>
          <Row k="Método" v={order.paymentMethod === "transferencia" ? "Transferencia" : order.paymentMethod[0].toUpperCase() + order.paymentMethod.slice(1)}/>
          <Row k="Tipo de documento" v={order.docType.charAt(0).toUpperCase() + order.docType.slice(1)}/>
          <Row k="Cliente" v={order.customer ? order.customer.name : "Venta General"}/>
          <Row k="ID Transacción" v={`TX-${Math.floor(800000000 + Math.random()*200000000)}`} mono/>
        </div>

        <div style={{display:"flex",gap:8,width:"100%",marginTop:18}}>
          <button onClick={onClose} className="sf-tap" style={{
            flex:1,height:52,background:"var(--sf-slate-100)",border:"none",borderRadius:16,color:"var(--sf-fg-2)",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          }}><Icon name="Receipt" size={14}/> Reimprimir</button>
          <button onClick={onClose} className="sf-tap" style={{
            flex:1,height:52,background:"linear-gradient(140deg,#4f46e5,#6366f1)",border:"none",borderRadius:16,color:"white",
            font:"900 11px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            boxShadow:"0 10px 24px -8px rgba(79,70,229,0.55)",
          }}>Nueva venta <Icon name="ChevronRight" size={14}/></button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bigV, mono }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{font:"900 9px/1 Inter",textTransform:"uppercase",letterSpacing:"0.14em",color:"var(--sf-fg-4)"}}>{k}</span>
      <span className={mono?"sf-tnum":"sf-tnum"} style={{
        font: bigV ? "900 18px/1 Inter" : "800 12px/1 Inter",
        color:"var(--sf-fg-1)",
        fontFamily: mono ? "ui-monospace, monospace" : "Inter, sans-serif",
        letterSpacing: bigV ? "-0.02em" : "-0.01em",
      }}>{v}</span>
    </div>
  );
}

window.PaymentSheet = PaymentSheet;
window.SuccessSheet = SuccessSheet;
