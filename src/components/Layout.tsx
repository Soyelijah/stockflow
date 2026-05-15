import React, { useState } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  LogOut, 
  Menu, 
  X,
  ChevronLeft,
  Bell,
  Search,
  Zap,
  Users,
  CreditCard,
  ArrowRightLeft,
  Smartphone,
  Settings as SettingsIcon
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { cn } from "../lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: any) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, logout } = useAuth();
  const { settings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "seller", "logistics"] },
    { id: "pos", label: "Ventas POS", icon: ShoppingCart, roles: ["admin", "manager", "seller"] },
    { id: "inventory", label: "Inventario", icon: Package, roles: ["admin", "manager", "logistics"] },
    { id: "logistics", label: "Logística", icon: ArrowRightLeft, roles: ["admin", "manager", "logistics"] },
    { id: "suppliers", label: "Proveedores", icon: Users, roles: ["admin", "manager"] },
    { id: "expenses", label: "Gastos", icon: CreditCard, roles: ["admin", "manager"] },
    { id: "kardex", label: "Kardex", icon: History, roles: ["admin", "manager", "logistics"] },
    { id: "transactions", label: "Historial", icon: History, roles: ["admin", "manager", "seller"] },
    { id: "settings", label: "Configuración", icon: SettingsIcon, roles: ["admin"] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(profile?.role || ""));

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col md:flex-row font-sans selection:bg-indigo-100">
      {/* Sidebar Desktop */}
      <aside 
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-40",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                <Zap size={18} className="text-white fill-white" />
              </div>
              <span className="font-black text-slate-800 text-xl tracking-tight truncate max-w-[140px]">
                {settings.businessName}
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="mx-auto w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap size={18} className="text-white fill-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center p-3 rounded-xl transition-all group relative",
                currentPage === item.id 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-colors",
                currentPage === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {!isSidebarCollapsed && (
                <span className="ml-3 font-semibold text-sm">{item.label}</span>
              )}
              {currentPage === item.id && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {!isSidebarCollapsed && (
            <div className="bg-slate-50 rounded-2xl p-3 mb-4 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                {profile?.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{profile?.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{profile?.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={cn(
              "w-full flex items-center p-3 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all",
              isSidebarCollapsed ? "justify-center" : "space-x-3"
            )}
          >
            <LogOut size={20} />
            {!isSidebarCollapsed && <span className="font-semibold text-sm">Cerrar Sesión</span>}
          </button>
          
          <button
            onClick={() => window.open("/mobile", "_blank")}
            className={cn(
              "w-full flex items-center p-3 mt-2 rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all",
              isSidebarCollapsed ? "justify-center" : "space-x-3"
            )}
          >
            <Smartphone size={20} />
            {!isSidebarCollapsed && <span className="font-semibold text-sm">App Vendedores</span>}
          </button>
        </div>
        
        {/* Collapse Toggle */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm z-50 transition-colors"
        >
          <ChevronLeft size={14} className={cn("transition-transform", isSidebarCollapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile Nav */}
      <header className="md:hidden bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <span className="font-black text-slate-800 text-xl tracking-tight truncate max-w-[180px]">
            {settings.businessName}
          </span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-50 rounded-xl text-slate-600"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Header Controls (Desktop) */}
        <header className="hidden md:flex bg-white h-16 items-center justify-end px-8 border-b border-slate-100">
          <div className="flex items-center space-x-6">
            <div className="relative group">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Busqueda rápida..." 
                className="bg-slate-50 border-none rounded-full py-2 pl-10 pr-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 w-64 transition-all"
              />
            </div>
            <button className="text-slate-400 hover:text-indigo-600 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {children}
        </main>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white z-[70] shadow-2xl p-6 flex flex-col md:hidden animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-8">
              <span className="font-black text-slate-800 text-2xl tracking-tight">StockFlow</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <nav className="flex-1 space-y-2">
              {filteredNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center p-4 rounded-2xl transition-all",
                    currentPage === item.id 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <item.icon size={22} className="mr-4" />
                  <span className="font-bold">{item.label}</span>
                </button>
              ))}
            </nav>
            
            <div className="mt-auto pt-6 border-t border-slate-100">
               <button
                onClick={logout}
                className="w-full flex items-center p-4 rounded-2xl text-red-600 hover:bg-red-50 transition-all font-bold"
              >
                <LogOut size={22} className="mr-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
