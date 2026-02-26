import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plane, Ship, ZoomIn, ShoppingCart, RefreshCw } from 'lucide-react';
import ProductOptions from './ProductOptions';
import { fixMojibake } from '../../utils/mojibakeFixer';

interface ProductActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  selectedOptions: Record<string, string>;
  onOptionSelect: (name: string, val: string) => void;
  onVariantSelect: (combination: Record<string, string>) => void;
  currentVariant: any;
  shippingMethod: 'air' | 'sea' | null;
  onShippingChange: (method: 'air' | 'sea') => void;
  onConfirm: () => void;
  isAdding: boolean;
  price: number;
}

const ProductActionSheet: React.FC<ProductActionSheetProps> = ({
  isOpen,
  onClose,
  product,
  selectedOptions,
  onOptionSelect,
  onVariantSelect,
  currentVariant,
  shippingMethod,
  onShippingChange,
  onConfirm,
  isAdding,
  price
}) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [areOptionsLoaded, setAreOptionsLoaded] = React.useState(false);

  // Check if options are loaded
  useEffect(() => {
    // Only consider options loaded if the options array exists (even if empty)
    // If product.options is undefined/null, it means we are still fetching details
    if (product && Array.isArray(product.options)) {
      setAreOptionsLoaded(true);
    } else {
      setAreOptionsLoaded(false);
    }
  }, [product]);

  // Reset zoom when sheet closes
  useEffect(() => {
    if (!isOpen) setIsZoomed(false);
  }, [isOpen]);

  const selectedImage = currentVariant?.image || product?.image;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        />
      )}
      
      {isOpen && (
        <motion.div
          key="sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[32px] z-[70] max-h-[85vh] flex flex-col shadow-xl"
        >
          {/* Header */}
            <div className="flex items-start gap-4 p-4 border-b border-slate-100 dark:border-slate-800">
              <div 
                className="relative size-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 cursor-zoom-in"
                onClick={() => setIsZoomed(true)}
              >
                <img 
                  src={selectedImage} 
                  alt={product?.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="text-white opacity-0 hover:opacity-100 transition-opacity drop-shadow-md" size={20} />
                </div>
              </div>

              <div className="flex-1 pt-1">
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-black text-primary">
                    {price > 0 ? `${price.toLocaleString()} د.ع` : 'السعر عند الطلب'}
                  </h3>
                  <button 
                    onClick={onClose}
                    className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {fixMojibake(product?.name)}
                </p>
                {currentVariant && (
                  <p className="text-xs font-bold text-slate-400 mt-2">
                    المحدد: {Object.values(selectedOptions).map(v => fixMojibake(v)).join(' / ')}
                  </p>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Options */}
              {product?.options && product.options.length > 0 && (
                <ProductOptions 
                  options={product.options}
                  selectedOptions={selectedOptions}
                  onOptionSelect={onOptionSelect}
                  variants={product.variants}
                  onVariantSelect={onVariantSelect}
                  selectedVariantId={currentVariant?.id}
                />
              )}
            </div>

            {/* Shipping Method - Sticky above footer */}
            <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-slate-900 dark:text-white text-xs font-black flex items-center gap-2 mb-1.5">
                طريقة الشحن
                <span className="text-[10px] text-slate-400 font-normal">(يجب الاختيار)</span>
              </h3>
              
              <div className="flex gap-2">
                <button
                  onClick={() => onShippingChange('air')}
                  disabled={product?.isAirRestricted}
                  className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    shippingMethod === 'air'
                      ? 'border-primary bg-primary/5 text-primary'
                      : product?.isAirRestricted 
                        ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plane size={18} />
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-xs">شحن جوي</span>
                      <span className="text-[10px] opacity-80">10-20 يوم</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-full">أغلى</span>
                    {product?.isAirRestricted && <span className="text-[9px] text-red-500 font-bold mt-0.5">غير متوفر</span>}
                  </div>
                </button>

                <button
                  onClick={() => onShippingChange('sea')}
                  className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    shippingMethod === 'sea'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Ship size={18} />
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-xs">شحن بحري</span>
                      <span className="text-[10px] opacity-80">شهرين</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 rounded-full">أرخص</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 pb-safe bg-white dark:bg-slate-900">
              <button
                onClick={onConfirm}
                disabled={isAdding || !areOptionsLoaded || !shippingMethod}
                className={`w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-black text-lg shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2 ${isAdding || !areOptionsLoaded || !shippingMethod ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isAdding ? (
                  <>
                    <RefreshCw size={24} className="animate-spin" />
                    <span>جاري الإضافة...</span>
                  </>
                ) : !areOptionsLoaded ? (
                  <>
                    <RefreshCw size={24} className="animate-spin" />
                    <span>جاري تحميل الخيارات...</span>
                  </>
                ) : !shippingMethod ? (
                  <>
                    <span>يرجى اختيار الشحن</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={24} />
                    <span>تأكيد وإضافة للسلة</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
      )}

      {/* Zoomed Image Overlay */}
      {isZoomed && isOpen && (
          <motion.div
            key="zoomed-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
          >
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={selectedImage}
              alt="Zoomed variant"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button 
              className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20"
              onClick={() => setIsZoomed(false)}
            >
              <X size={24} />
            </button>
          </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProductActionSheet;
