import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProducts } from '../services/api';
import { useWishlistStore } from '../store/useWishlistStore';
import { usePageCacheStore } from '../store/usePageCacheStore';
import Skeleton from '../components/Skeleton';
import { useTranslation } from 'react-i18next';
import SearchBar from '../components/home/SearchBar';
import ProductCard from '../components/home/ProductCard';
import { Grid2X2, Smartphone, Shirt, Sparkles, Banknote, AlertCircle, PackageSearch } from 'lucide-react';
import type { Product } from '../types/product';

const categoryToSearchTerm: Record<string, string> = {
  all: '',
  electronics: 'إلكترونيات أجهزة ذكية electronics tech',
  fashion: 'ملابس أزياء موضة fashion clothes',
  new: 'جديد وصل حديثاً new arrivals',
  under5k: '', 
};

const Home: React.FC = () => {
  const { t } = useTranslation();
  
  // Categories definition with translations and icons
  const staticCategories = React.useMemo(() => [
    { id: 'all', name: t('home.recommended') || 'المقترحة', icon: Grid2X2 },
    { id: 'electronics', name: 'إلكترونيات', icon: Smartphone },
    { id: 'fashion', name: 'أزياء', icon: Shirt },
    { id: 'new', name: 'جديدنا', icon: Sparkles },
    { id: 'under5k', name: 'أقل من 5,000 د.ع', icon: Banknote },
  ], [t]);

  const navigate = useNavigate();
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  // Read initial state from store without subscribing to updates (except categoryId)
  const homeCategoryId = usePageCacheStore((state) => state.homeCategoryId);
  const setHomeData = usePageCacheStore((state) => state.setHomeData);
  const setHomeScrollPos = usePageCacheStore((state) => state.setHomeScrollPos);

  const [products, setProducts] = useState<Product[]>(() => usePageCacheStore.getState().homeProducts);
  const [loading, setLoading] = useState(() => usePageCacheStore.getState().homeProducts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Infinite Scroll & Categories State
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(homeCategoryId);
  const scrollTargetRef = useRef<HTMLElement[]>([]);
  const observer = useRef<IntersectionObserver | null>(null);
  const [_page, setPage] = useState(() => usePageCacheStore.getState().homePage);

  const activeRequestRef = useRef<string | null>(null);

  const loadData = useCallback(async (pageNum: number, categoryId: string, isInitial = false, retryCount = 0) => {
    const requestId = `${categoryId}-${pageNum}-${Date.now()}`;
    activeRequestRef.current = requestId;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      setError(null);
      const searchTerm = categoryToSearchTerm[categoryId] || '';
      const maxPrice = categoryId === 'under5k' ? 5000 : undefined;
      
      const prodsRes = await fetchProducts(pageNum, 10, searchTerm, maxPrice);

      // Only proceed if this is still the active request for this category
      if (activeRequestRef.current !== requestId) return;

      const newProducts = prodsRes.products || [];
      
      if (isInitial) {
        setProducts(newProducts);
        setHomeData(newProducts, pageNum, categoryId);
      } else {
        setProducts(prev => {
          // Filter out any duplicates that might have been returned by the server
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewProducts = newProducts.filter((p: Product) => !existingIds.has(p.id));
          
          const updated = [...prev, ...uniqueNewProducts];
          setHomeData(updated, pageNum, categoryId);
          return updated;
        });
      }
      
      setHasMore(newProducts.length === 10);
      
    } catch (err: any) {
      if (activeRequestRef.current !== requestId) return;
      console.error('Error loading data:', err);
      
      // Auto-retry for initial load failures up to 2 times
      if (isInitial && retryCount < 2) {
        const delay = (retryCount + 1) * 1500;
        console.log(`Retrying initial load (${retryCount + 1}/2) in ${delay}ms...`);
        setTimeout(() => loadData(pageNum, categoryId, isInitial, retryCount + 1), delay);
        return;
      }

      setError(err.message || t('common.error_loading'));
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [setHomeData, t]);

  useEffect(() => {
    // Only load if we don't have products or if the category has changed
    if (selectedCategoryId !== homeCategoryId) {
      setProducts([]); 
      setHasMore(true);
      loadData(1, selectedCategoryId, true);
      setPage(1);
    } else if (products.length === 0 && !error) {
      loadData(1, selectedCategoryId, true);
    }
  }, [selectedCategoryId, homeCategoryId, loadData]);

  // Restore scroll position only on mount if we have data
  useEffect(() => {
    const homeScrollPos = usePageCacheStore.getState().homeScrollPos;
    if (products.length > 0 && homeScrollPos > 0) {
      setTimeout(() => {
        window.scrollTo(0, homeScrollPos);
        if (document.scrollingElement) {
          document.scrollingElement.scrollTop = homeScrollPos;
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scroll position and handle search bar visibility
  useEffect(() => {
    let timeoutId: any = null;

    const resolveScrollTargets = () => {
      const scrollingEl = document.scrollingElement as HTMLElement | null;
      const body = document.body;
      const root = document.getElementById('root') as HTMLElement | null;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('main, [data-scroll-container], [data-scroll-root], .scroll-container, .overflow-y-auto, .overflow-auto, .overflow-y-scroll'));
      const combined = [scrollingEl, body, root, ...candidates].filter(Boolean) as HTMLElement[];
      const unique = Array.from(new Set(combined));
      const scrollables = unique.filter((el) => {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && el.scrollHeight > el.clientHeight;
      });
      if (scrollables.length > 0) return scrollables;
      return [scrollingEl, body, root].filter(Boolean) as HTMLElement[];
    };

    scrollTargetRef.current = resolveScrollTargets();

    const getScrollY = (e?: Event) => {
      const target = e?.target as HTMLElement | null;
      if (target && typeof target.scrollTop === 'number') {
        const scrollTop = target.scrollTop;
        const scrollHeight = target.scrollHeight;
        const clientHeight = target.clientHeight;
        if (scrollHeight > clientHeight) return scrollTop;
      }
      const fixedTargets = scrollTargetRef.current;
      for (const targetEl of fixedTargets) {
        if (targetEl && typeof targetEl.scrollTop === 'number') return targetEl.scrollTop;
      }
      const se = document.scrollingElement as null | { scrollTop?: unknown };
      if (se && typeof se.scrollTop === 'number') return se.scrollTop;
      return window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const handleScroll = (e?: Event) => {
      // Separate debounced task for saving scroll position (not for visibility)
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setHomeScrollPos(getScrollY(e));
      }, 150);
    };

    const scrollTargets = scrollTargetRef.current;
    if (scrollTargets.length > 0) {
      scrollTargets.forEach((target) => {
        target.addEventListener('scroll', handleScroll, { passive: true });
      });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('touchmove', handleScroll, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (scrollTargets.length > 0) {
        scrollTargets.forEach((target) => {
          target.removeEventListener('scroll', handleScroll);
        });
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('touchmove', handleScroll);
    };
  }, [setHomeScrollPos]);

  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          loadData(nextPage, selectedCategoryId);
          return nextPage;
        });
      }
    }, { rootMargin: '50% 0px', threshold: 0.01 });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, selectedCategoryId, loadData]);

  const prefetchedCategories = useRef<Set<string>>(new Set());

  // Idle prefetching
  useEffect(() => {
    if (loading || products.length === 0) return;

    const idleCallback = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 2000));
    
    const handleIdle = () => {
      staticCategories.forEach(async (cat) => {
        if (cat.id !== selectedCategoryId && !prefetchedCategories.current.has(cat.id)) {
          try {
            const searchTerm = categoryToSearchTerm[cat.id] || '';
            const maxPrice = cat.id === 'under5k' ? 5000 : undefined;
            await fetchProducts(1, 10, searchTerm, maxPrice);
            prefetchedCategories.current.add(cat.id);
            console.log(`Prefetched category on idle: ${cat.id}`);
          } catch (err) {
            // Silently fail
          }
        }
      });
    };

    const handle = idleCallback(handleIdle);
    return () => {
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [loading, products.length, selectedCategoryId, loadData]);

  const isProductInWishlist = (productId: number | string) => wishlistItems.some(item => String(item.productId) === String(productId));

  const handleAddToWishlist = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    toggleWishlist(product.id, product);
  };



  if (loading && products.length === 0) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark font-display text-text-primary-light dark:text-text-primary-dark antialiased pt-[calc(env(safe-area-inset-top)+1rem)]" dir="rtl">
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
            </div>
            <p className="text-sm font-bold text-slate-500 animate-pulse">جاري تحضير طلبك...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-28 pb-safe bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl" dir="rtl">
      {/* Search Bar */}
      <SearchBar onNavigate={navigate} />

      <div className="transition-all duration-300"></div>

        {error && (
          <div className="mx-4 mt-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="flex-1 font-medium">{error}</p>
            <button 
              onClick={() => loadData(1, selectedCategoryId, true)}
              className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Discovery Feed */}
        <div className="mt-4 flex flex-col px-4">
          {selectedCategoryId !== 'all' && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {staticCategories.find(c => c.id === selectedCategoryId)?.name}
              </h2>
            </div>
          )}
          
          {!loading && !error && products.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6 pb-6">
                {products.map((product, index) => (
                  <div 
                    key={product.id}
                    ref={index === products.length - 1 ? lastProductElementRef : null}
                  >
                    <ProductCard 
                      product={product}
                      onNavigate={(id) => navigate(`/product?id=${id}`, { state: { initialProduct: product } })}
                      onAddToWishlist={handleAddToWishlist}
                      isProductInWishlist={isProductInWishlist}
                    />
                  </div>
                ))}
              </div>

              {loadingMore && (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 animate-pulse">
                    <div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">جاري تحميل المزيد...</span>
                  </div>
                </div>
              )}
              
              {!loadingMore && !hasMore && products.length > 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-700"></div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">وصلت إلى نهاية النتائج</p>
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-700"></div>
                </div>
              )}
            </>
          )}

          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6 pb-6">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="aspect-[3/4] w-full rounded-2xl shadow-sm" />
                  <div className="px-1 space-y-2">
                    <Skeleton variant="text" className="h-4 w-full" />
                    <Skeleton variant="text" className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && products.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-6" dir="rtl">
              <div className="size-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                <PackageSearch size={48} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">لا توجد منتجات حالياً</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-[260px] mx-auto">
                  نحن نعمل على إضافة منتجات جديدة باستمرار. جرب البحث عن شيء آخر أو العودة للتصنيفات الرئيسية.
                </p>
              </div>
              <button 
                onClick={() => setSelectedCategoryId('all')}
                className="px-8 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                العودة للكل
              </button>
            </div>
          )}
        </div>
      </div>
  );
};

export default Home;
