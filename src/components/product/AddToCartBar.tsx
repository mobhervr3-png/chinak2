import React from 'react';
import { ShoppingCart, RefreshCw, ShoppingBag } from 'lucide-react';

interface AddToCartBarProps {
  price: number;
  onAddToCart: () => void;
  isAdding: boolean;
  isAdded?: boolean;
  onGoToCart?: () => void;
}

const AddToCartBar: React.FC<AddToCartBarProps> = ({
  price,
  onAddToCart,
  isAdding,
  isAdded,
  onGoToCart,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-900/5 dark:border-white/10 px-4 py-3 pb-safe transition-colors shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-3">
        {/* Add to Cart Button */}
        {isAdded && onGoToCart ? (
          <button
            onClick={onGoToCart}
            className="flex-1 flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white py-3 px-6 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all duration-300 active:scale-[0.98]"
          >
            <ShoppingBag size={20} strokeWidth={2.5} />
            <span>إتمام الشراء</span>
          </button>
        ) : (
          <button
            onClick={onAddToCart}
            disabled={isAdding}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-4 px-6 rounded-xl font-black shadow-lg shadow-primary/25 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isAdding ? (
              <div className="flex items-center gap-2">
                <RefreshCw size={20} className="animate-spin" />
                <span>جاري الإضافة...</span>
              </div>
            ) : (
              <>
                <ShoppingCart size={20} strokeWidth={2.5} />
                <div className="flex items-center gap-1.5">
                  <span>إضافة للسلة</span>
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-lg">{price.toLocaleString()}</span>
                  <span className="text-xs opacity-90">د.ع</span>
                </div>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default AddToCartBar;
