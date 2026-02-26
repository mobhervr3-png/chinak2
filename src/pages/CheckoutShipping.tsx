import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  MapPin, 
  ChevronLeft, 
  MapPinPlus, 
  X, 
  ArrowLeft, 
  Check,
  Home,
  Briefcase,
  Plus,
  AlertCircle,
  Plane,
  Ship
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchAddresses, calculateShipping } from '../services/api';
import type { ShippingInfo as _ShippingInfo } from '../types/shipping';
import { useCartStore } from '../store/useCartStore';
import { useCheckoutStore } from '../store/useCheckoutStore';
import { useToastStore } from '../store/useToastStore';
import DiscountPopup from '../components/DiscountPopup';

const CheckoutShipping: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { 
    selectedAddressId, 
    setSelectedAddressId, 
    shippingMethod, 
    setShippingMethod,
    appliedCoupon,
    setAppliedCoupon,
    setShippingFee,
    shippingInfo,
    setShippingInfo
  } = useCheckoutStore();
  
  const allCartItems = useCartStore((state) => state.items);
  const cartItems = React.useMemo(() => 
    allCartItems.filter(item => item.shippingMethod === shippingMethod),
    [allCartItems, shippingMethod]
  );
  const fetchCart = useCartStore((state) => state.fetchCart);
  const subtotal = useCartStore((state) => state.getSubtotal(shippingMethod)); // Filtered by shipping method
  const baseSubtotal = useCartStore((state) => state.getBaseSubtotal(shippingMethod)); // Filtered by shipping method
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [isDiscountPopupOpen, setIsDiscountPopupOpen] = useState(false);

  // Single effect to manage shipping info calculation
  useEffect(() => {
    const updateShipping = async () => {
      if (cartItems.length === 0) {
        setShippingFee(0);
        setShippingInfo(null);
        return;
      }
      
      setCalculatingShipping(true);
      try {
        const info = await calculateShipping(cartItems, shippingMethod);
        setShippingInfo(info);
        setShippingFee(info.fee);
      } catch (err) {
        console.error('Failed to calculate shipping:', err);
      } finally {
        setCalculatingShipping(false);
      }
    };
    
    updateShipping();
  }, [cartItems, shippingMethod, setShippingFee, setShippingInfo]);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchCart(),
          fetchAddresses().then(setAddresses)
        ]);
        
        // Default to air unless already set
        if (!shippingMethod) {
          setShippingMethod('air');
        }
        
        // If no address selected in store, pick default or first
        const addressData = await fetchAddresses();
        if (!selectedAddressId && addressData && addressData.length > 0) {
          const defaultAddr = addressData.find((a: any) => a.isDefault) || addressData[0];
          setSelectedAddressId(defaultAddr.id);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        showToast('فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.', 'error');
      } finally {
        // Add a slight delay to make the loading page visible as requested
        setTimeout(() => {
          setLoading(false);
        }, 1500);
      }
    };
    loadData();
    // Only run on mount or when critical dependencies change
  }, [fetchCart, setShippingMethod, setSelectedAddressId, showToast]);

  useEffect(() => {
    if (!loading && shippingInfo && !shippingInfo.isThresholdMet) {
      showToast('يرجى الوصول للحد الأدنى للطلب للمتابعة', 'error');
      navigate('/cart');
    }
  }, [loading, shippingInfo, navigate, showToast]);

  // Shipping fee is managed by the shipping calculation effect above
  
  const discountAmount = appliedCoupon ? (
    appliedCoupon.discountType === 'PERCENTAGE' 
      ? Math.min(
          (baseSubtotal * (appliedCoupon.discountValue / 100)), 
          appliedCoupon.maxDiscount || Infinity
        )
      : appliedCoupon.discountValue
  ) : 0;

  const total = Math.max(0, subtotal - discountAmount);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  if (loading) return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark shadow-2xl font-display text-text-primary-light dark:text-text-primary-dark antialiased" dir="rtl">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
          </div>
          <span className="text-sm font-bold text-slate-500 animate-pulse">جاري تحضير طلبك...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-text-primary-light dark:text-text-primary-dark antialiased pb-32 pt-safe" dir="rtl">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/cart')}
            className="w-10 h-10 rounded-full bg-surface-light dark:bg-surface-dark shadow-soft flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
          >
            <ArrowRight size={20} />
          </button>
          <h1 className="text-xl font-black">إتمام الطلب</h1>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-8">
        {/* Section: Shipping Address */}
        <section className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">عنوان التوصيل</h3>
            <button 
              onClick={() => setShowAddressSheet(true)}
              className="text-sm text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              {addresses.length > 0 ? 'تغيير' : 'إضافة عنوان'}
            </button>
          </div>
          
          {selectedAddress ? (
            <div 
              onClick={() => setShowAddressSheet(true)}
              className="group bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-soft border border-border-light dark:border-border-dark hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors"></div>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MapPin size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{selectedAddress.name}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-wider">{selectedAddress.type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-medium ltr mt-0.5" dir="ltr">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 text-green-600">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <span>{selectedAddress.phone}</span>
                  </div>
                </div>
              </div>
              <div className="pr-16">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {selectedAddress.street}, {selectedAddress.city}
                  {selectedAddress.buildingNo && `، بناية ${selectedAddress.buildingNo}`}
                  {selectedAddress.floorNo && `، طابق ${selectedAddress.floorNo}`}
                </p>
              </div>
              <div className="absolute top-5 left-5 text-slate-300 dark:text-slate-600">
                <ChevronLeft size={20} />
              </div>
            </div>
          ) : (
            <motion.div 
              onClick={() => navigate('/addresses/add', { state: { from: '/checkout/shipping' } })}
              initial={{ opacity: 0.8, scale: 0.98 }}
              animate={{ 
                opacity: [0.8, 1, 0.8],
                scale: [0.98, 1.02, 0.98],
                borderColor: ['#e2e8f0', '#3b82f6', '#e2e8f0']
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="bg-primary/5 dark:bg-primary/10 rounded-3xl p-12 border-2 border-dashed border-primary/30 dark:border-primary/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
              
              <div className="w-20 h-20 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform relative">
                <MapPinPlus size={40} className="text-primary animate-pulse" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center">
                  <Plus size={14} strokeWidth={3} />
                </div>
              </div>
              
              <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">لا يوجد عنوان محفوظ</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed">
                يرجى إضافة عنوان توصيل لتتمكن من متابعة الطلب
              </p>
              
              <div className="mt-6 bg-primary text-white px-6 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 group-hover:shadow-primary/40 transition-all">
                <span>إضافة عنوان الآن</span>
                <Plus size={18} />
              </div>
            </motion.div>
          )}
        </section>

        {/* Section: Shipping Method Display */}
        <section className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
            <h3 className="text-lg font-bold">طريقة الشحن</h3>
            <div className="flex items-center gap-4 bg-surface-light dark:bg-surface-dark rounded-3xl p-5 shadow-soft border border-border-light dark:border-border-dark">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    shippingMethod === 'air' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                }`}>
                    {shippingMethod === 'air' ? <Plane size={24} /> : <Ship size={24} />}
                </div>
                <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        {shippingMethod === 'air' ? 'شحن جوي' : 'شحن بحري'}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {shippingMethod === 'air' ? '10-20 يوم' : 'شهرين'}
                    </p>
                </div>
            </div>
        </section>

        {/* Min Order Warning */}
        {shippingInfo && !shippingInfo.isThresholdMet && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
            <div className="flex flex-col">
              <p className="text-amber-900 dark:text-amber-200 text-sm font-bold">الطلب أقل من الحد الأدنى</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                الحد الأدنى للشحن {shippingMethod === 'air' ? 'الجوي' : 'البحري'} هو {shippingInfo.threshold.toLocaleString()} د.ع. <br/>
                يرجى إضافة <span className="font-black text-amber-900 dark:text-amber-100">{(shippingInfo.threshold - shippingInfo.subtotal).toLocaleString()} د.ع</span> لتتمكن من متابعة الطلب.
              </p>
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <section className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-5 border border-slate-100 dark:border-slate-700 space-y-3">
          {/* Items List */}
          <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700/50">
            {cartItems.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <img 
                    src={item.variant?.image || item.product?.image} 
                    alt={item.product?.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black px-1 rounded-bl-md">
                    {item.quantity}x
                  </div>
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product?.name}</p>
                  {(item.variant && item.variant.combination || item.selectedOptions) && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(() => {
                        try {
                          const combination = item.selectedOptions 
                            ? (typeof item.selectedOptions === 'string' ? JSON.parse(item.selectedOptions) : item.selectedOptions)
                            : (item.variant && typeof item.variant.combination === 'string' 
                              ? JSON.parse(item.variant.combination) 
                              : item.variant?.combination);
                          
                          if (!combination || Object.keys(combination).length === 0) {
                            const rawCombination = item.selectedOptions || item.variant?.combination;
                            if (!rawCombination) return null;
                            return (
                              <span className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                                {String(rawCombination)}
                              </span>
                            );
                          }

                          return Object.entries(combination).map(([key, value]) => (
                            <span key={key} className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                              {key}: {String(value)}
                            </span>
                          ));
                        } catch (e) {
                          const rawCombination = item.selectedOptions || item.variant?.combination;
                          if (!rawCombination) return null;
                          return (
                            <span className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                              {String(rawCombination)}
                            </span>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white shrink-0">
                  {((item.variant?.price || item.product?.price || 0) * item.quantity).toLocaleString()} د.ع
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">المجموع الفرعي</span>
            <span className="font-bold">{subtotal.toLocaleString()} د.ع</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 dark:text-slate-400">كوبون الخصم</span>
              {appliedCoupon && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                  <span>{appliedCoupon.code}</span>
                  <button 
                    onClick={() => setAppliedCoupon(null)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsDiscountPopupOpen(true)}
              className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              {appliedCoupon ? 'تغيير' : 'إضافة كوبون'}
            </button>
          </div>

          {appliedCoupon && (
            <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
              <span>قيمة الخصم</span>
              <span className="font-bold">- {discountAmount.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">الشحن الدولي</span>
            <span className="font-bold text-slate-900 dark:text-white">سيتم إرسالها إليك عبر الواتساب</span>
          </div>

          {shippingInfo && !shippingInfo.isThresholdMet && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed text-center">
                الحد الأدنى للطلب للشحن {shippingMethod === 'air' ? 'الجوي' : 'البحري'} هو {shippingInfo.threshold.toLocaleString()} د.ع. <br/>
                يرجى إضافة <span className="underline font-black">{(shippingInfo.threshold - shippingInfo.subtotal).toLocaleString()} د.ع</span> لتتمكن من متابعة الطلب.
              </p>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center">
            <span className="font-bold">المجموع الكلي</span>
            <span className="text-xl font-black text-primary">{total.toLocaleString()} د.ع</span>
          </div>
        </section>
      </div>

      <DiscountPopup
        isOpen={isDiscountPopupOpen}
        onClose={() => setIsDiscountPopupOpen(false)}
        orderAmount={subtotal}
        onApply={setAppliedCoupon}
        appliedCoupon={appliedCoupon}
      />

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark z-40">
        <div className="w-full mx-auto">
          <button 
            onClick={() => navigate('/checkout/payment-address')}
            disabled={!selectedAddressId || (shippingInfo !== null && !shippingInfo.isThresholdMet) || calculatingShipping}
            className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            <span>{calculatingShipping ? 'جاري الحساب...' : shippingInfo && !shippingInfo.isThresholdMet ? 'الطلب أقل من الحد الأدنى' : 'متابعة'}</span>
            <ArrowLeft size={20} className="transform rotate-180 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Address Selection Sheet */}
      {showAddressSheet && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowAddressSheet(false)}
          ></div>
          <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[85vh] overflow-hidden flex flex-col border-x border-t border-slate-100 dark:border-slate-800 pb-safe">
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-4 mb-2 shrink-0"></div>
            
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">تغيير عنوان التوصيل</h3>
                <p className="text-xs text-slate-500 font-medium">اختر من عناوينك المحفوظة</p>
              </div>
              <button 
                onClick={() => navigate('/addresses/add', { state: { from: '/checkout/shipping' } })}
                className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <MapPinPlus size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar">
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <div 
                    key={addr.id}
                    onClick={() => {
                      setSelectedAddressId(addr.id);
                      setShowAddressSheet(false);
                    }}
                    className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                      isSelected 
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5 ring-1 ring-primary/20' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    {/* Background Pattern for Selected */}
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                    )}

                    <div className="flex items-start gap-4 relative z-10">
                      {/* Icon Container */}
                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        isSelected 
                          ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' 
                          : 'bg-white dark:bg-slate-700 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 border border-slate-100 dark:border-slate-600'
                      }`}>
                        {addr.type === 'المنزل' ? <Home size={24} /> : addr.type === 'العمل' ? <Briefcase size={24} /> : <MapPin size={24} />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm transition-colors ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{addr.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 uppercase tracking-wider">{addr.type}</span>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 ltr" dir="ltr">
                            <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500/10 text-green-600">
                              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </div>
                            <span>{addr.phone}</span>
                          </div>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 mt-2 ${isSelected ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500'}`}>
                          {addr.street}, {addr.city}
                        </p>
                      </div>

                      {/* Checkbox/Radio Indicator */}
                      <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                        isSelected 
                          ? 'bg-primary border-primary scale-110 shadow-md shadow-primary/20' 
                          : 'border-slate-200 dark:border-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-600'
                      }`}>
                        {isSelected && (
                          <Check size={14} strokeWidth={4} className="text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-6 bg-white dark:bg-slate-900 shrink-0"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutShipping;
