import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bolt, Heart } from 'lucide-react';
import LazyImage from '../LazyImage';
import Skeleton from '../Skeleton';
import { calculateInclusivePrice } from '../../utils/shipping';
import { fetchSettings } from '../../services/api';
import type { Product } from '../../types/product';

interface FlashSalesProps {
  products: Product[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onAddToWishlist: (e: React.MouseEvent, product: Product) => void;
  isProductInWishlist: (productId: number | string) => boolean;
}

const FlashSales: React.FC<FlashSalesProps> = ({
  products,
  loading,
  onNavigate,
  onAddToWishlist,
  isProductInWishlist,
}) => {
  const { t } = useTranslation();
  const [rates, setRates] = useState({
    airRate: 15400,
    seaRate: 182000,
    minFloor: 0
  });

  useEffect(() => {
    const loadRates = async () => {
      try {
        const settings = await fetchSettings();
        if (settings) {
          setRates({
            airRate: settings.airShippingRate || 15400,
            seaRate: settings.seaShippingRate || 182000,
            minFloor: 0
          });
        }
      } catch (e) {}
    };
    loadRates();
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-4 bg-gradient-to-b from-transparent to-white dark:to-slate-900/50 py-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-red-600 dark:text-red-500">
            <Bolt size={20} fill="currentColor" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('common.flash_sales')}</h2>
          </div>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 no-scrollbar">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="flex w-36 shrink-0 flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton variant="text" className="h-3 w-24" />
              <Skeleton variant="text" className="h-4 w-16" />
            </div>
          ))
        ) : (
          products.slice(0, 4).map((product, index) => {
            const minVariant = (!product.variants || product.variants.length === 0) 
              ? null 
              : product.variants.reduce((prev, curr) => {
                  if (!prev.price) return curr;
                  if (!curr.price) return prev;
                  return prev.price < curr.price ? prev : curr;
                });

            const minPrice = minVariant ? (minVariant.price || product.price) : product.price;
            // const effectiveWeight = minVariant ? (minVariant.weight || product.weight) : product.weight;
            // const effectiveLength = minVariant ? (minVariant.length || product.length) : product.length;
            // const effectiveWidth = minVariant ? (minVariant.width || product.width) : product.width;
            // const effectiveHeight = minVariant ? (minVariant.height || product.height) : product.height;

            // const isEffectivePriceCombined = minVariant 
            //   ? (minVariant.isPriceCombined ?? product.isPriceCombined ?? false)
            //   : (product.isPriceCombined ?? false);

            // const effectiveBasePriceRMB = (minVariant && minVariant.basePriceRMB && minVariant.basePriceRMB > 0)
            //   ? minVariant.basePriceRMB
            //   : product.basePriceRMB;

            const totalPrice = calculateInclusivePrice(
              minPrice,
              product.domesticShippingFee || 0,
              minVariant ? minVariant.basePriceIQD : product.basePriceIQD,
              rates
            );

            return (
              <div 
                key={product.id}
                onClick={() => onNavigate(`/product?id=${product.id}`)}
                className="flex w-36 shrink-0 flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 cursor-pointer group"
              >
                <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-700">
                  <div className="absolute left-2 top-2 z-10 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">-10%</div>
                  
                  <button 
                    onClick={(e) => onAddToWishlist(e, product)}
                    className={`absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white ${isProductInWishlist(product.id) ? 'text-red-500' : 'text-slate-400'}`}
                  >
                    <Heart size={16} fill={isProductInWishlist(product.id) ? "currentColor" : "none"} />
                  </button>
                  <LazyImage 
                    src={product.image} 
                    alt={product.name}
                    priority={index < 2}
                    objectFit="contain"
                    className="h-full w-full bg-white"
                  />
                </div>
                <div className="flex flex-col p-3">
                  <h3 className="line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200">{product.name}</h3>
                  <div className="mt-2 flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-primary">{totalPrice.toLocaleString()} د.ع</span>
                    <span className="text-[10px] text-slate-400 line-through">{(totalPrice * 1.1).toLocaleString()} د.ع</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FlashSales;
