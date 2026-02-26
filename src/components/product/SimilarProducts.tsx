import React from 'react';
import LazyImage from '../LazyImage';
import { calculateInclusivePrice } from '../../utils/shipping';
import type { Product } from '../../types/product';

interface SimilarProductsProps {
  products: Product[];
  onProductClick: (id: number | string) => void;
}

const SimilarProducts: React.FC<SimilarProductsProps> = ({ products, onProductClick }) => {
  if (products.length === 0) return null;

  return (
    <div className="mb-8 px-5">
      <h3 className="text-slate-900 dark:text-white text-lg font-black mb-4">منتجات مشابهة</h3>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
        {products.map((p) => {
          const variants = p.variants || [];
          
          const minVariant = variants.reduce((min: any, curr: any) => {
            if (!curr.price) return min;
            if (!min) return curr;
            return curr.price < min.price ? curr : min;
          }, null);

          const minPrice = minVariant ? Number(minVariant.price) : Number(p.price);
          
          const effectiveBasePriceIQD = (minVariant && minVariant.basePriceIQD && minVariant.basePriceIQD > 0)
            ? minVariant.basePriceIQD
            : p.basePriceIQD;

          const totalPrice = calculateInclusivePrice(
            minPrice,
            p.domesticShippingFee || 0,
            effectiveBasePriceIQD
          );

          return (
            <div 
              key={p.id}
              onClick={() => onProductClick(p.id)}
              className="w-40 shrink-0 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-white/5 cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <div className="aspect-square relative overflow-hidden bg-slate-100 dark:bg-slate-700">
                <LazyImage 
                  src={p.image} 
                  alt={p.name}
                  objectFit="contain"
                  className="w-full h-full bg-white"
                />
              </div>
              <div className="p-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 h-8 mb-2 leading-snug">
                  {p.name}
                </h4>
                <div className="text-primary font-black text-sm">
                  {totalPrice.toLocaleString()} د.ع
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SimilarProducts;
