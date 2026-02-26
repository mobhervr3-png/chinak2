import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { Home, ShoppingBag, ShoppingCart, Heart, User, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomNavProps {
  className?: string;
}

const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemsCount = useCartStore((state) => state.getTotalItems());

  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Home, path: '/' },
    { id: 'orders', label: 'طلباتي', icon: ShoppingBag, path: '/orders' },
    { id: 'cart', label: 'السلة', icon: ShoppingCart, path: '/cart', badge: cartItemsCount },
    { id: 'categories', label: 'التصنيفات', icon: LayoutGrid, path: '/categories' },
    { id: 'profile', label: 'حسابي', icon: User, path: '/profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-[calc(env(safe-area-inset-bottom))] transition-transform duration-300 dark:bg-slate-900 dark:border-slate-800 ${className}`}
    >
      <div className="mx-auto w-full max-w-md h-[60px] flex items-center justify-between px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <button 
              key={item.id}
              onClick={() => navigate(item.path)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 h-full w-full active:scale-95 transition-transform duration-200"
            >
              <div className="relative">
                <Icon 
                  size={24} 
                  strokeWidth={active ? 2.5 : 2} 
                  className={`transition-colors duration-200 ${active ? 'text-primary fill-primary/10' : 'text-slate-500 dark:text-slate-400'}`} 
                />
                
                <AnimatePresence>
                  {item.badge && item.badge > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-1 ring-white dark:ring-slate-900"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              
              <span className={`text-[11px] font-medium transition-colors duration-200 ${
                active ? 'text-primary' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
