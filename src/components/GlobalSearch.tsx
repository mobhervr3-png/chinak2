import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, SearchCode, Keyboard } from 'lucide-react';
import LazyImage from './LazyImage';
import { calculateInclusivePrice } from '../utils/shipping';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  orders: any[];
  users: any[];
  onSelectAction: (type: string, item: any) => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  isOpen, 
  onClose, 
  products, 
  orders, 
  users,
  onSelectAction
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    products: any[];
    orders: any[];
    users: any[];
  }>({ products: [], orders: [], users: [] });


  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], orders: [], users: [] });
      return;
    }

    const q = query.toLowerCase();
    
    // Improved Arabic normalization variations for search
    const normalize = (text: string) => 
      text.toLowerCase()
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
          .trim();

    const normalizedQuery = normalize(query);
    const cleanQuery = query.replace(/[\\/.,()!?;:]/g, ' ');
    const normalizedCleanQuery = normalize(cleanQuery);
    const keywords = normalizedCleanQuery.split(/\s+/).filter(k => k.length > 1);
    
    const filteredProducts = products.filter(p => {
      const normalizedName = normalize(p.name || '');
      const normalizedChineseName = p.chineseName ? normalize(p.chineseName) : '';
      const idMatch = p.id.toString().includes(query);
      
      // Match if full query is in name or chinese name
      const fullMatch = 
        normalizedName.includes(normalizedQuery) || 
        normalizedChineseName.includes(normalizedQuery) ||
        normalizedName.includes(normalizedCleanQuery);
      
      // Lenient keyword match: at least 70% of keywords must match
      let matchCount = 0;
      if (keywords.length > 0) {
        keywords.forEach(k => {
          if (normalizedName.includes(k) || normalizedChineseName.includes(k)) {
            matchCount++;
          }
        });
      }
      
      const keywordMatch = keywords.length > 0 && (matchCount / keywords.length) >= 0.7;
      
      return idMatch || fullMatch || keywordMatch;
    })
    .sort((a, b) => {
      // Basic relevance sorting for the preview
      const aName = normalize(a.name || '');
      const bName = normalize(b.name || '');
      const aExact = aName.includes(normalizedQuery) ? 1 : 0;
      const bExact = bName.includes(normalizedQuery) ? 1 : 0;
      return bExact - aExact;
    })
    .slice(0, 5);

    const filteredOrders = orders.filter(o => {
       const orderIdStr = o.id.toString();
       const trackingIdMatch = query.match(/#?IQ-(\d+)/i);
       
       if (trackingIdMatch) {
         return orderIdStr === trackingIdMatch[1];
       }

      return (
        orderIdStr.includes(q) || 
        o.user?.name?.toLowerCase().includes(q) ||
        o.user?.phone?.toLowerCase().includes(q)
      );
    }).slice(0, 5);

    const filteredUsers = users.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.phone?.toLowerCase().includes(q) ||
      u.id.toString().includes(q)
    ).slice(0, 5);

    setResults({
      products: filteredProducts,
      orders: filteredOrders,
      users: filteredUsers
    });
  }, [query, products, orders, users]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto p-4 sm:p-6 md:p-20" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className="mx-auto w-full max-w-7xl transform divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 sm:text-sm text-right"
            placeholder="البحث عن منتجات، طلبات، أو عملاء... (Ctrl+K)"
            dir="rtl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        {(results.products.length > 0 || results.orders.length > 0 || results.users.length > 0) ? (
          <div className="max-h-96 scroll-py-2 overflow-y-auto py-2 text-sm text-slate-800 dark:text-slate-200" dir="rtl">
            {results.products.length > 0 && (
              <div className="px-4 py-2">
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">المنتجات</h3>
                <div className="space-y-1">
                  {results.products.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        onSelectAction('PRODUCT', product);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <LazyImage 
                        src={product.image} 
                        alt="" 
                        className="h-8 w-8 rounded-lg object-cover" 
                        isThumbnail={true}
                      />
                      <div className="flex-1">
                        <p className="font-bold">{product.name}</p>
                        <p className="text-[10px] text-slate-500">
                          #{product.id} • {
                            calculateInclusivePrice(
                              product.price,
                              product.domesticShippingFee || 0,
                              product.basePriceRMB,
                              product.isPriceCombined
                            ).toLocaleString()
                          } د.ع
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.orders.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-50 dark:border-slate-700/50">
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">الطلبات</h3>
                <div className="space-y-1">
                  {results.orders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => {
                        onSelectAction('ORDER', order);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <ShoppingCart size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">طلب #{order.id}</p>
                        <p className="text-[10px] text-slate-500">{order.user?.name} • {order.total.toLocaleString()} د.ع</p>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                        {order.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.users.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-50 dark:border-slate-700/50">
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">العملاء</h3>
                <div className="space-y-1">
                  {results.users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSelectAction('USER', user);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 font-bold text-xs uppercase">
                        {user.name?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{user.name}</p>
                        <p className="text-[10px] text-slate-500" dir="ltr">{user.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : query.trim() ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <SearchCode className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm font-bold text-slate-500">لا توجد نتائج مطابقة لـ "{query}"</p>
            <p className="mt-1 text-xs text-slate-400">جرب البحث بكلمات أخرى أو رقم الطلب</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Keyboard className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm font-bold text-slate-500">ابدأ البحث...</p>
            <p className="mt-1 text-xs text-slate-400">يمكنك البحث عن المنتجات، الطلبات، أو العملاء</p>
          </div>
        )}

        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-[10px] font-black text-slate-400">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="font-sans">ESC</kbd> للإغلاق</span>
            <span className="flex items-center gap-1"><kbd className="font-sans">↵</kbd> للاختيار</span>
          </div>
          <span>بحث ذكي للمسؤولين</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
