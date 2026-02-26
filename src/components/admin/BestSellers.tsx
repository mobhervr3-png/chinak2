import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LazyImage from '../LazyImage';
import { calculateInclusivePrice } from '../../utils/shipping';
import { fetchSettings } from '../../services/api';
import { Truck } from 'lucide-react';

interface BestSellersProps {
  products: any[];
  onViewAll: () => void;
}

const BestSellers: React.FC<BestSellersProps> = ({ products, onViewAll }) => {
  const { t } = useTranslation();
  const [rates, setRates] = useState<any>({
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
      } catch (error) {
        console.error('Failed to load shipping rates:', error);
      }
    };
    loadRates();
  }, []);

  const productsWithStats = useMemo(() => {
    return products.slice(0, 6).map((p, i) => ({
      ...p,
      orderCount: (i * 7 + 13) % 40 + 10
    }));
  }, [products]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-row-reverse">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('dashboard.overview.best_sellers')}</h3>
        <button onClick={onViewAll} className="text-xs font-bold text-primary hover:underline">{t('common.view_all')}</button>
      </div>
      <div className="space-y-4 flex-1">
        {productsWithStats.map((product, i) => {
          const minVariant = (product.variants && product.variants.length > 0)
            ? product.variants.reduce((prev: any, curr: any) => {
                if (!prev.price) return curr;
                if (!curr.price) return prev;
                return prev.price < curr.price ? prev : curr;
              })
            : null;

          const minPrice = minVariant ? (minVariant.price || product.price) : product.price;

          const effectiveBasePriceIQD = (minVariant && minVariant.basePriceIQD && minVariant.basePriceIQD > 0)
            ? minVariant.basePriceIQD
            : product.basePriceIQD;

          const totalPrice = calculateInclusivePrice(
            minPrice, 
            product.domesticShippingFee || 0, 
            effectiveBasePriceIQD,
            rates
          );

          return (
          <div key={i} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex-row-reverse">
            <div className="relative">
              <LazyImage 
                src={product.image} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover shadow-sm" 
                isThumbnail={true}
              />
              <div className="absolute -top-1 -left-1 w-5 h-5 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                {i + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate text-right">{product.name}</p>
              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                <span className="text-[9px] font-bold text-slate-400">
                  {t('common.base_price')}: {product.price.toLocaleString()} {t('common.iqd')}
                </span>
                <div className="flex items-center gap-1 text-primary">
                  <Truck size={10} className="opacity-70" />
                  <span className="text-[11px] font-black">
                    {totalPrice.toLocaleString()} {t('common.iqd')}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                {product.orderCount} {t('dashboard.overview.orders_suffix')}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default BestSellers;
