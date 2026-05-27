// QuickActions — premium 4-card row with depth and gradient icon chips.

function QuickActions({ onScan, onClose, onCustomer, onKardex }) {
  const items = [
    { ic: "Camera",     palette: "indigoSolid",  label: "Escanear",  onClick: onScan },
    { ic: "Users",      palette: "purpleSolid",  label: "Clientes",  onClick: onCustomer },
    { ic: "Package",    palette: "emeraldSolid", label: "Kardex",    onClick: onKardex },
    { ic: "Lock",       palette: "amberSolid",   label: "Cierre",    onClick: onClose },
  ];
  return (
    <div style={{display:"flex",gap:8}}>
      {items.map((it,i) => (
        <button key={i} className="sf-qa sf-item-in" style={{animationDelay: `${80 + i*45}ms`}} onClick={it.onClick}>
          <div className="ic-wrap">
            <IconChip name={it.ic} palette={it.palette} size={42} icSize={18}/>
          </div>
          <span className="label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

window.QuickActions = QuickActions;
