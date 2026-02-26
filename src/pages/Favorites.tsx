import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import LazyImage from '../components/LazyImage';
import { calculateInclusivePrice } from '../utils/shipping';

import { ArrowLeft, ShoppingBag, LayoutGrid, List, Heart, ShoppingCart, Star } from 'lucide-react';

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const wishlist = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const addItem = useCartStore((state) => state.addItem);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const showToast = useToastStore((state) => state.showToast);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleMoveAllToCart = async () => {
    if (wishlist.length === 0) return;
    try {
      await Promise.all(wishlist.map(item => addItem(item.product.id, 1)));
      showToast(`تمت إضافة ${wishlist.length} منتجات إلى السلة`, 'success');
      navigate('/cart');
    } catch (err) {
      showToast('حدث خطأ أثناء إضافة المنتجات للسلة', 'error');
    }
  };

  const handleAddToCart = async (product: any) => {
    if (!isAuthenticated) {
      showToast('يرجى تسجيل الدخول أولاً لإضافة منتجات إلى السلة', 'info');
      navigate('/login');
      return;
    }
    try {
      await addItem(product.id, 1);
      showToast('تمت إضافة المنتج إلى السلة', 'success');
    } catch (err) {
      showToast('فشل في إضافة المنتج للسلة', 'error');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl pb-28 pb-safe rtl pt-safe" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
            >
              <ArrowLeft size={24} className="rtl:rotate-180" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">المفضلة</h1>
          </div>
          {wishlist.length > 0 && (
            <button 
              onClick={handleMoveAllToCart}
              className="flex items-center gap-1 text-primary font-bold text-sm bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              <ShoppingBag size={18} />
              أضف الكل
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex h-10 w-full items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 p-1">
          <button 
            onClick={() => setViewMode('grid')}
            className={`flex h-full flex-1 items-center justify-center gap-2 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid size={20} />
            <span className="text-sm font-medium">شبكة</span>
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`flex h-full flex-1 items-center justify-center gap-2 rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <List size={20} />
            <span className="text-sm font-medium">قائمة</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-4">
        {wishlist.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700">
              <Heart size={48} />
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">المفضلة فارغة</h2>
            <p className="mb-8 text-slate-500">لم تقم بإضافة أي منتجات للمفضلة بعد</p>
            <button 
              onClick={() => navigate('/')}
              className="rounded-full bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              استكشف المنتجات
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {wishlist.map((item) => {
              const product = item.product;
              const variants = product.variants || [];
              
              // Find the cheapest variant to get the correct price AND weight
              const minVariant = variants.reduce((min: any, curr: any) => {
                if (!curr.price) return min;
                if (!min) return curr;
                return curr.price < min.price ? curr : min;
              }, null);

              const minPrice = minVariant ? minVariant.price : product.price;
              
              const effectiveBasePriceIQD = (minVariant && minVariant.basePriceIQD && minVariant.basePriceIQD > 0)
                ? minVariant.basePriceIQD
                : product.basePriceIQD;

              return (
                <div 
                  key={product.id} 
                  onClick={() => navigate(`/product?id=${product.id}`, { state: { initialProduct: product } })}
                  className="group flex flex-col gap-3 rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <LazyImage 
                      src={product.image} 
                      alt={product.name}
                      objectFit="contain"
                      className="w-full h-full bg-white"
                    />
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id, product);
                      }}
                      className="absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm text-red-500"
                    >
                      <Heart size={20} className="fill-current" />
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      className="absolute bottom-2 left-2 flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark active:scale-90 transition-transform"
                    >
                      <ShoppingCart size={20} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 min-h-[2.5rem] leading-tight">
                      {product.name}
                    </h3>
                    
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={14} className="fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">4.8 (120)</span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-primary text-base font-bold">
                        {calculateInclusivePrice(
                          minPrice,
                          product.domesticShippingFee || 0,
                          effectiveBasePriceIQD
                        ).toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pt-4">
            {wishlist.map((item) => {
              const product = item.product;
              const variants = product.variants || [];
              
              // Find the cheapest variant to get the correct price AND weight
              const minVariant = variants.reduce((min: any, curr: any) => {
                if (!curr.price) return min;
                if (!min) return curr;
                return curr.price < min.price ? curr : min;
              }, null);

              const minPrice = minVariant ? minVariant.price : product.price;
              
              const effectiveBasePriceIQD = (minVariant && minVariant.basePriceIQD && minVariant.basePriceIQD > 0)
                ? minVariant.basePriceIQD
                : product.basePriceIQD;

              return (
                <div 
                  key={product.id} 
                  onClick={() => navigate(`/product?id=${product.id}`, { state: { initialProduct: product } })}
                  className="flex gap-4 rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm transition-transform active:scale-[0.99] cursor-pointer items-center"
                >
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                    <LazyImage 
                      src={product.image} 
                      alt={product.name}
                      objectFit="contain"
                      className="w-full h-full bg-white"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center py-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-lg font-bold text-primary">
                        {calculateInclusivePrice(
                          minPrice,
                          product.domesticShippingFee || 0,
                          effectiveBasePriceIQD
                        ).toLocaleString()} د.ع
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id, product);
                      }}
                      className="size-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 active:scale-95 transition-transform"
                    >
                      <Heart size={18} className="fill-current" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary active:scale-95 transition-transform"
                    >
                      <ShoppingCart size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Favorites;
