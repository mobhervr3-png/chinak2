import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  Settings, 
  Ticket,
  LogOut,
  Search,
  Bell,
  User,
  Menu,
  X,
  Home
} from 'lucide-react';
import Logo from './Logo';
import { useAuthStore } from '../store/useAuthStore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, path: '/admin' },
    { id: 'products', label: 'المنتجات', icon: Package, path: '/admin/products' },
    { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
    { id: 'orders', label: 'الطلبات', icon: ShoppingCart, path: '/admin/orders' },
    { id: 'coupons', label: 'الكوبونات', icon: Ticket, path: '/admin/coupons' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-display rtl" dir="rtl">
      {/* Mobile Overlay */}
      <div 
        className={`
          fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] lg:hidden cursor-pointer transition-opacity duration-300
          ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 right-0 h-screen w-64 max-w-[85vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 
          flex flex-col z-[50] transition-all duration-300 shadow-2xl lg:shadow-none
          lg:sticky lg:translate-x-0 lg:z-30 lg:visible lg:opacity-100
          ${isSidebarOpen ? 'translate-x-0 visible opacity-100' : 'translate-x-full invisible opacity-0 lg:translate-x-0'}
        `}
      >
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-xl font-black text-slate-900 dark:text-white">شيناك أدمن</span>
          </div>
          <button 
            className="lg:hidden p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-slate-800 rounded-xl cursor-pointer active:scale-95 transition-all"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close Sidebar"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-4 mb-4">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all border border-primary/10"
          >
            <Home size={20} />
            العودة للمتجر
          </NavLink>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/admin'}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all
                ${isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
              `}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
          >
            <LogOut size={20} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Header */}
        <header className="h-16 lg:h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer active:scale-95 transition-transform"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Sidebar"
              type="button"
            >
              <Menu size={24} />
            </button>

            <button 
              onClick={() => navigate('/')}
              className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all sm:hidden"
              title="العودة للمتجر"
            >
              <Home size={22} />
            </button>
            
            <div className="relative max-w-xl w-full hidden sm:block">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="ابحث عن أي شيء..."
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-2.5 pr-11 pl-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              <Bell size={22} />
              <span className="absolute top-2 left-2 w-2 h-2 bg-primary rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            
            <div className="flex items-center gap-3 pr-3 lg:pr-6 border-r border-slate-200 dark:border-slate-800">
              <div className="text-left hidden xs:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[150px] lg:max-w-none">{user?.name || 'الأدمن'}</p>
                <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">{user?.role || 'ADMIN'}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {user?.name?.[0] || <User size={20} />}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
