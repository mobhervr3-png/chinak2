import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { performCacheMaintenance, searchProducts } from '../services/api';
import { useWishlistStore } from '../store/useWishlistStore';
import { usePageCacheStore } from '../store/usePageCacheStore';
import { useUserPreferencesStore } from '../store/useUserPreferencesStore';
import SearchHeader from '../components/search/SearchHeader';
import SearchEmptyState from '../components/search/SearchEmptyState';
import SearchSuggestionsList from '../components/search/SearchSuggestionsList';
import SearchLoadingState from '../components/search/SearchLoadingState';
import SearchProductCard from '../components/search/SearchProductCard';
import type { Product } from '../types/product';

import { AlertCircle, ArrowUp } from 'lucide-react';

const SearchResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const isProductInWishlist = (productId: number | string) => wishlistItems.some(item => String(item.productId) === String(productId));
  
  // Get query from URL if present
  const queryParams = new URLSearchParams(location.search);
  const initialQuery = queryParams.get('q') || '';

  const searchResults = usePageCacheStore((state) => state.searchResults);
  const cachedQuery = usePageCacheStore((state) => state.searchQuery);
  const setSearchData = usePageCacheStore((state) => state.setSearchData);
  const setSearchScrollPos = usePageCacheStore((state) => state.setSearchScrollPos);

  const [searchQuery, setSearchQuery] = useState(initialQuery || cachedQuery);
  const [isTyping, setIsTyping] = useState(initialQuery ? false : true);
  const [products, setProducts] = useState<Product[]>(searchResults);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(searchResults);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [activeFilter] = useState('all');
  const [sortBy] = useState<'none' | 'price_asc' | 'price_desc' | 'rating'>('none');
  
  // Use User Preferences Store
  const recentSearches = useUserPreferencesStore((state) => state.searchHistory);
  const addSearchHistory = useUserPreferencesStore((state) => state.addSearchHistory);
  const clearHistory = useUserPreferencesStore((state) => state.clearHistory);
  
  const scrollTargetsRef = useRef<HTMLElement[]>([]);

  const observer = useRef<IntersectionObserver | null>(null);

  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prev => prev + 1);
      }
    }, { rootMargin: '50% 0px', threshold: 0.01 });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const popularSearches = ['سماعات لاسلكية', 'آيفون 15', 'ساعة ذكية', 'أحذية رياضية', 'عطور رجالية'];

  useEffect(() => {
    // If query in URL changes, update search query state
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q !== searchQuery) {
      setSearchQuery(q);
      setIsTyping(false); // When a query is provided via URL, show results immediately
    }
  }, [location.search, searchQuery]);

  const addToRecentSearches = useCallback((query: string) => {
    if (!query.trim()) return;
    addSearchHistory(query);
  }, [addSearchHistory]);

  const clearRecentSearches = () => {
    clearHistory();
  };

  useEffect(() => {
    const searchScrollPos = usePageCacheStore.getState().searchScrollPos;
    if (products.length > 0) {
      setTimeout(() => {
        window.scrollTo(0, searchScrollPos);
        if (document.scrollingElement) {
          document.scrollingElement.scrollTop = searchScrollPos;
        }
      }, 50);
    }
    // Only run on initial mount to restore scroll position
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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

    scrollTargetsRef.current = resolveScrollTargets();

    const getScrollY = (e?: Event) => {
      const target = e?.target as unknown;
      if (target && typeof target === 'object') {
        const el = target as { scrollTop?: unknown; scrollHeight?: unknown; clientHeight?: unknown };
        const scrollTop = typeof el.scrollTop === 'number' ? el.scrollTop : null;
        const scrollHeight = typeof el.scrollHeight === 'number' ? el.scrollHeight : null;
        const clientHeight = typeof el.clientHeight === 'number' ? el.clientHeight : null;
        if (scrollTop !== null && scrollHeight !== null && clientHeight !== null && scrollHeight > clientHeight) {
          return scrollTop;
        }
      }

      const fixedTargets = scrollTargetsRef.current;
      for (const targetEl of fixedTargets) {
        if (targetEl && typeof targetEl.scrollTop === 'number') return targetEl.scrollTop;
      }
      const se = document.scrollingElement as null | { scrollTop?: unknown };
      if (se && typeof se.scrollTop === 'number') return se.scrollTop;
      return window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const handleScroll = (e?: Event) => {
      // Save scroll position
      setSearchScrollPos(getScrollY(e));
    };
    const scrollTargets = scrollTargetsRef.current;
    if (scrollTargets.length > 0) {
      scrollTargets.forEach((target) => {
        target.addEventListener('scroll', handleScroll, { passive: true });
      });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('touchmove', handleScroll, { passive: true });
    return () => {
      if (scrollTargets.length > 0) {
        scrollTargets.forEach((target) => {
          target.removeEventListener('scroll', handleScroll);
        });
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('touchmove', handleScroll);
    };
  }, [setSearchScrollPos]);

  useEffect(() => {
    let isMounted = true;
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setProducts([]);
        setFilteredProducts([]);
        setError(null);
        setHasMore(false);
        return;
      }
      
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      
      setError(null);
      const startTime = Date.now();
      const querySnapshot = searchQuery;
      try {
        console.log('[SearchResults] request_start', { query: querySnapshot, page });
        const data = await searchProducts(searchQuery, page);
        if (!isMounted) return;

        const newProducts = data.products || [];
        const total = data.total || 0;
        const serverHasMore = data.hasMore !== undefined ? data.hasMore : newProducts.length === 20;
        console.log('[SearchResults] request_success', { query: querySnapshot, page, returned: newProducts.length, total, elapsedMs: Date.now() - startTime });

        if (page === 1) {
          setProducts(newProducts);
          setFilteredProducts(newProducts);
          setTotalResults(total);
          setSearchData(newProducts, searchQuery);
          if (newProducts.length > 0 && searchQuery) {
            addToRecentSearches(searchQuery);
          }
        } else {
          setProducts(prev => {
            // Filter out any duplicates that might have been returned by the server
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNewProducts = newProducts.filter((p: Product) => !existingIds.has(p.id));
            
            const updated = [...prev, ...uniqueNewProducts];
            setSearchData(updated, searchQuery);
            return updated;
          });
        }
        
        setHasMore(serverHasMore);
      } catch (err) {
        if (!isMounted) return;
        console.error('Search failed:', err);
        console.log('[SearchResults] request_error', { query: querySnapshot, page, elapsedMs: Date.now() - startTime });
        setError('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    const timeoutId = setTimeout(performSearch, page === 1 ? 500 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, page, setSearchData, addToRecentSearches]);

  useEffect(() => {
    // Reset page when search query changes
    setPage(1);
    setHasMore(true);
  }, [searchQuery]);

  const getProductBasePrice = useCallback((p: Product) => {
    const variants = (p as any).variants || [];
    const variantPrices = variants
      .map((v: any) => Number(v?.price))
      .filter((price: number) => !isNaN(price) && price > 0);
    return variantPrices.length > 0 ? Math.min(...variantPrices) : Number(p.price);
  }, []);

  useEffect(() => {
    let result = [...products];
    const getNumericId = (id: number | string) => (typeof id === 'number' ? id : Number.parseInt(String(id), 10) || 0);

    // Apply filters
    if (activeFilter === 'free_shipping') {
      // Products over 30,000 IQD get free shipping in our business logic
      result = result.filter(p => getProductBasePrice(p) >= 30000); 
    } else if (activeFilter === 'top_rated') {
      // Simulated top rated (products with even IDs for demo)
      result = result.filter(p => getNumericId(p.id) % 2 === 0);
    } else if (activeFilter === 'under_25k') {
      result = result.filter(p => getProductBasePrice(p) < 25000);
    }

    // Apply sorting
    if (sortBy === 'price_asc') {
      result.sort((a, b) => getProductBasePrice(a) - getProductBasePrice(b));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => getProductBasePrice(b) - getProductBasePrice(a));
    } else if (sortBy === 'rating') {
      // Sort by simulated rating (higher IDs first for demo)
      result.sort((a, b) => getNumericId(b.id) - getNumericId(a.id));
    }

    setFilteredProducts(result);
  }, [activeFilter, sortBy, products, getProductBasePrice]);





  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl overflow-visible" dir="rtl">
         <SearchHeader 
           query={searchQuery}
           onQueryChange={(q) => {
             setSearchQuery(q);
             if (q.trim()) setIsTyping(true);
           }}
           onBack={() => navigate('/')}
           onFocus={() => {
             if (searchQuery.trim()) setIsTyping(true);
           }}
           onClear={() => {
             setSearchQuery('');
             setIsTyping(false);
           }}
           onSubmit={() => setIsTyping(false)}
         />
         
         <div className="transition-all duration-300"></div>

        <main className="flex-1 p-3 pb-12">
          {isTyping && searchQuery.trim() && (
            <SearchSuggestionsList 
              query={searchQuery}
              onSelect={(q) => {
                setSearchQuery(q);
                setIsTyping(false);
              }}
            />
          )}

          {!isTyping && searchQuery && !loading && filteredProducts.length > 0 && (
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">النتائج لـ "{searchQuery}"</h2>
              <span className="text-sm text-slate-500">{totalResults || filteredProducts.length} منتج</span>
            </div>
          )}

          {!isTyping && loading && <SearchLoadingState query={searchQuery} />}

          {!isTyping && error && (
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={40} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">عذراً، حدث خطأ</h3>
              <p className="text-slate-500 text-sm mb-6">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary text-white rounded-xl font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!isTyping && !loading && !error && searchQuery && filteredProducts.length === 0 && (
            <SearchEmptyState 
              query={searchQuery}
              popularSearches={popularSearches}
              onSelect={setSearchQuery}
            />
          )}

          {!isTyping && !loading && !error && !searchQuery && (
            <SearchEmptyState 
              query=""
              popularSearches={popularSearches}
              recentSearches={recentSearches}
              onSelect={(q) => {
                setSearchQuery(q);
                setIsTyping(false);
              }}
              onClearRecent={clearRecentSearches}
            />
          )}

          {!isTyping && !loading && !error && filteredProducts.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product, index) => (
                  <div 
                    key={product.id}
                    ref={index === filteredProducts.length - 1 ? lastProductElementRef : null}
                  >
                    <SearchProductCard 
                      product={product}
                      onNavigate={(id) => navigate(`/product?id=${id}`, { state: { initialProduct: product } })}
                      onToggleWishlist={(p) => toggleWishlist(p.id, p)}
                      isWishlisted={isProductInWishlist(product.id)}
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
              
              {!loadingMore && !hasMore && filteredProducts.length > 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-700"></div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">وصلت إلى نهاية النتائج</p>
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-700"></div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating Action Button: Scroll to Top */}
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 left-6 z-40 size-12 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-all"
        >
          <ArrowUp size={24} />
        </button>
      </div>
  );
};

export default SearchResults;
