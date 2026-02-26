import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, XCircle, CheckCircle2, Tag, Ticket } from 'lucide-react';
import { validateCoupon, fetchCoupons } from '../services/api';
import { useToastStore } from '../store/useToastStore';

interface Coupon {
  id: number;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrder?: number;
  endDate?: string;
  description?: string;
}

interface DiscountPopupProps {
  isOpen: boolean;
  onClose: () => void;
  orderAmount: number;
  onApply: (coupon: Coupon) => void;
  appliedCoupon: Coupon | null;
}

const DiscountPopup: React.FC<DiscountPopupProps> = ({ 
  isOpen, 
  onClose, 
  orderAmount, 
  onApply,
  appliedCoupon 
}) => {
  const [code, setCode] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    if (isOpen) {
      loadAvailableCoupons();
    }
  }, [isOpen]);

  const loadAvailableCoupons = async () => {
    setIsLoading(true);
    try {
      const coupons = await fetchCoupons();
      setAvailableCoupons(coupons);
    } catch (err) {
      console.error('Failed to load coupons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!code.trim()) return;
    setIsValidating(true);
    try {
      const result = await validateCoupon(code, orderAmount);
      onApply(result);
      showToast('تم تطبيق الكوبون بنجاح', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'كود الخصم غير صحيح أو غير فعال', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSelectCoupon = async (coupon: Coupon) => {
    if (appliedCoupon?.id === coupon.id) return;
    
    setIsValidating(true);
    try {
      const result = await validateCoupon(coupon.code, orderAmount);
      onApply(result);
      showToast('تم تطبيق الكوبون بنجاح', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'لا يمكن تطبيق هذا الكوبون حالياً', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[101] bg-white dark:bg-slate-900 rounded-t-[32px] w-full max-w-7xl mx-auto overflow-hidden shadow-xl"
            dir="rtl"
          >
            <div className="px-6 pt-4 pb-8 pb-safe">
              {/* Handle */}
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">الكوبونات والخصومات</h2>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Apply Code Input */}
              <div className="flex gap-2 mb-8">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="أدخل كود الخصم"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-right uppercase tracking-wider"
                  />
                  {code && (
                    <button 
                      onClick={() => setCode('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleValidate}
                  disabled={!code || isValidating}
                  className="bg-primary text-white px-6 rounded-2xl text-sm font-black disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-primary/20"
                >
                  {isValidating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'تطبيق'}
                </button>
              </div>

              {/* Applied Coupon Info */}
              {appliedCoupon && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold">كوبون مفعل</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{appliedCoupon.code}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onApply(null as any)}
                    className="text-red-500 text-xs font-bold underline"
                  >
                    إلغاء
                  </button>
                </div>
              )}

              {/* Available Coupons */}
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-1">كوبونات متاحة لك</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pb-4">
                  {isLoading ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2].map(i => (
                        <div key={i} className="h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : availableCoupons.length > 0 ? (
                    availableCoupons.map((coupon) => (
                      <button
                        key={coupon.id}
                        onClick={() => handleSelectCoupon(coupon)}
                        disabled={isValidating || (appliedCoupon?.id === coupon.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-right group ${
                          appliedCoupon?.id === coupon.id
                            ? 'bg-primary/5 border-primary shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:border-primary/30'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          appliedCoupon?.id === coupon.id
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
                        }`}>
                          <Tag size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{coupon.code}</span>
                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                              {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `${coupon.discountValue.toLocaleString()} د.ع`} خصم
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                            {coupon.description || `خصم ${coupon.discountType === 'PERCENTAGE' ? 'بنسبة' : 'بمبلغ'} ${coupon.discountValue} على طلبك`}
                          </p>
                          {coupon.minOrder && (
                            <p className="text-[9px] text-slate-400 mt-1 font-bold">
                              * متاح للطلبات فوق {coupon.minOrder.toLocaleString()} د.ع
                            </p>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Ticket size={32} className="text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 font-bold">لا توجد كوبونات متاحة حالياً</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Note */}
              <p className="text-[10px] text-center text-slate-400 mt-6 font-medium">
                * يمكنك استخدام كوبون واحد فقط لكل طلب
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DiscountPopup;
