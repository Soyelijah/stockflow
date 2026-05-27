// Lucide-style inline SVG icons. Stroke 2px, 24x24 default.
// Subset used by the worker mobile app — exported globally for Babel scripts.

const Icon = ({ name, size = 18, className = "", style = {}, strokeWidth = 2, fill = "none" }) => {
  const p = paths[name] || paths.Square;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill === "none" ? "none" : fill}
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden="true"
    >
      {p}
    </svg>
  );
};

const paths = {
  Zap: <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor" stroke="none" />,
  Store: <><path d="m2 7 1.5-4h17L22 7"/><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M22 7H2"/><path d="M2 11h20"/></>,
  ShoppingCart: <><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></>,
  User: <><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></>,
  Users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  Search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
  Plus: <><path d="M5 12h14M12 5v14"/></>,
  Minus: <path d="M5 12h14"/>,
  X: <path d="M18 6 6 18M6 6l12 12"/>,
  Check: <path d="M20 6 9 17l-5-5"/>,
  CheckCircle2: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
  Trash2: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></>,
  Camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></>,
  Tag: <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></>,
  Ticket: <><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a2 2 0 0 0 0 4v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-2a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 17v2M13 11v2"/></>,
  FileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
  CreditCard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>,
  Banknote: <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></>,
  Smartphone: <><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/></>,
  RefreshCw: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
  Wifi: <><path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.5a6 6 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0M12 20h.01"/></>,
  WifiOff: <><path d="M2 2l20 20M8.5 16.5a6 6 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5.0A15 15 0 0 1 22 8.82M16.85 11.25a11 11 0 0 1 2.15 1.3M5 12.55a11 11 0 0 1 5.17-2.39M12 20h.01"/></>,
  Lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  Unlock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>,
  TrendingUp: <><path d="m22 7-9.5 9.5-5-5L1 18"/><path d="M17 7h5v5"/></>,
  Coins: <><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.71.71-2.83 2.83"/></>,
  LogOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  Bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  Mail: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></>,
  Eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  EyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A11 11 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/></>,
  ChevronLeft: <path d="m15 18-6-6 6-6"/>,
  ChevronRight: <path d="m9 18 6-6-6-6"/>,
  ShieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
  Loader2: <path d="M21 12a9 9 0 1 1-6.219-8.56"/>,
  AlertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></>,
  Building2: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M2 22h20"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></>,
  Package: <><path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></>,
  Receipt: <path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v17l-3-2-3 2-3-2-3 2-3-2-3 2V9z M8 7h8M8 11h8M8 15h5"/>,
  Truck: <><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h12c.6 0 1 .4 1 1v10"/><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  Sparkles: <><path d="M9.94 14.34a1 1 0 0 0-1.88 0L7 17l-2.66 1.06a1 1 0 0 0 0 1.88L7 21l1.06 2.66a1 1 0 0 0 1.88 0L11 21l2.66-1.06a1 1 0 0 0 0-1.88L11 17z"/><path d="M14 4l1.5 4.5L20 10l-4.5 1.5L14 16l-1.5-4.5L8 10l4.5-1.5L14 4z"/></>,
  Activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
  PieChart: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>,
  Filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>,
  Star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
  Settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3.6 15H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  Square: <rect x="3" y="3" width="18" height="18" rx="2"/>,
};

window.Icon = Icon;
