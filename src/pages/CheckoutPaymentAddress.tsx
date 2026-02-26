import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  MapPin, 
  ChevronLeft, 
  MapPinPlus, 
  Key, 
  Wallet, 
  CheckCircle2, 
  ArrowLeft, 
  Check,
  Home,
  Briefcase,
  Tag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchAddresses, placeOrder, fetchCoupons } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useCheckoutStore } from '../store/useCheckoutStore';
import { useToastStore } from '../store/useToastStore';

const CheckoutPaymentAddress: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { 
    selectedAddressId, 
    setSelectedAddressId, 
    paymentMethod, 
    setPaymentMethod,
    shippingMethod,
    appliedCoupon,
    shippingFee: _shippingFee,
    shippingInfo,
    resetCheckout
  } = useCheckoutStore();

  const [addresses, setAddresses] = useState<any[]>([]);
  const allCartItems = useCartStore((state) => state.items);
  const cartItems = allCartItems.filter(item => item.shippingMethod === shippingMethod);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const subtotal = useCartStore((state) => state.getSubtotal(shippingMethod));
  const baseSubtotal = useCartStore((state) => state.getBaseSubtotal(shippingMethod));
  const [loading, setLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'none' | 'processing' | 'verifying' | 'success'>('none');
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [hasAvailableCoupons, setHasAvailableCoupons] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<number | string | null>(null);
  const [_orderedItems, setOrderedItems] = useState<any[]>([]);
  const [snapshottedSubtotal, setSnapshottedSubtotal] = useState(0);
  const [snapshottedTotal, setSnapshottedTotal] = useState(0);
  const [snapshottedDiscount, setSnapshottedDiscount] = useState(0);

  const checkAvailableCoupons = useCallback(async () => {
    try {
      const coupons = await fetchCoupons();
      setHasAvailableCoupons(coupons.length > 0);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [addrData] = await Promise.all([
        fetchAddresses(),
        fetchCart()
      ]);
      setAddresses(addrData);
      
      // If no address selected in store, pick default or first
      if (!selectedAddressId && addrData.length > 0) {
        const defaultAddr = addrData.find((a: any) => a.isDefault) || addrData[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch (err) {
      console.error('Failed to load checkout data', err);
    } finally {
      setLoading(false);
    }
  }, [fetchCart, selectedAddressId, setSelectedAddressId]);

  useEffect(() => {
     loadData();
     checkAvailableCoupons();
   }, [loadData, checkAvailableCoupons]);

   useEffect(() => {
     if (shippingInfo && !shippingInfo.isThresholdMet) {
       navigate('/checkout/shipping');
       showToast('الطلب أقل من الحد الأدنى للشحن المختار', 'error');
     }
     if (shippingMethod === 'air' && shippingInfo?.isAvailable === false) {
       navigate('/checkout/shipping');
       showToast('الشحن الجوي غير متوفر لبعض المنتجات في سلتك', 'error');
     }
   }, [shippingInfo, shippingMethod, navigate, showToast]);

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      showToast('يرجى اختيار عنوان التوصيل', 'error');
      return null;
    }

    const currentSubtotal = subtotal;
    const currentTotal = total;
    const currentDiscount = discountAmount;
    
    setSnapshottedSubtotal(currentSubtotal);
    setSnapshottedTotal(currentTotal);
    setSnapshottedDiscount(currentDiscount);
    setOrderedItems([...cartItems]);

    // Directly process order without confirmation modal
    await processOrderPlacement();
    return null;
  };

  const processOrderPlacement = async () => {
    setIsPlacingOrder(true);
    setPaymentStep('processing');
    
    try {
      // Create the order
      const order = await placeOrder(
        selectedAddressId!, 
        paymentMethod, 
        shippingMethod, 
        appliedCoupon?.code,
        cartItems
      );
      
      const currentItems = [...cartItems];
      setCreatedOrderId(order.id);

      // Show success message as requested
      showToast("سيتم إرسال تكلفة الشحن إليك عبر رقم الواتساب الخاص بك قريباً جداً", 'success', 5000);

      // Clear cart items for the ordered shipping method in store
      useCartStore.getState().clearShippingMethodItems(shippingMethod);
      await fetchCart();
      
      setPaymentStep('success');
      resetCheckout();
      
      setTimeout(() => {
        if (order && order.id) {
          navigate('/order-confirmation', { 
            state: { 
              order: {
                ...order,
                items: currentItems,
                total: order.total || snapshottedTotal,
                discountAmount: order.discountAmount || snapshottedDiscount,
                subtotal: snapshottedSubtotal,
                internationalShippingFee: (shippingInfo?.internationalFee || 0)
              } 
            }, 
            replace: true 
          });
        } else {
          navigate('/');
        }
      }, 1500);

      return order;
    } catch (err: any) {
      setPaymentStep('none');
      setIsPlacingOrder(false);
      showToast(err.message || 'فشل في إتمام الطلب. يرجى المحاولة مرة أخرى.', 'error');
      return null;
    }
  };

  // Shipping cost is determined later based on weight/size
  const discountAmount = appliedCoupon ? (
    appliedCoupon.discountType === 'PERCENTAGE' 
    ? Math.min(
        (baseSubtotal * (appliedCoupon.discountValue / 100)), 
        appliedCoupon.maxDiscount || Infinity
      )
    : appliedCoupon.discountValue
  ) : 0;
  
  // subtotal already includes shippingTotal from getSubtotal()
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
      <header className="sticky top-0 z-50 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark transition-colors duration-300 pt-safe">
        <div className="flex items-center justify-between p-4 h-14">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-primary-light dark:text-text-primary-dark"
          >
            <ArrowLeft size={24} className="transform rotate-180" />
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em]">إتمام الشراء</h1>
          <div className="w-10 h-10"></div> {/* Spacer for centering */}
        </div>

        <div className="flex items-center justify-center pb-2">
          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-500/20">
            <CheckCircle2 size={12} />
            <span>توصيل مادي للعنوان</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full p-4 space-y-4">
        {/* Section: Address */}
        <section className="space-y-3 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">عنوان التوصيل</h3>
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
              onClick={() => navigate('/addresses/add', { state: { from: '/checkout/payment-address' } })}
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
                  <span className="text-xs font-black">+</span>
                </div>
              </div>
              
              <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">لا يوجد عنوان محفوظ</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed">
                يرجى إضافة عنوان توصيل لتتمكن من متابعة الطلب
              </p>
              
              <div className="mt-6 bg-primary text-white px-6 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 group-hover:shadow-primary/40 transition-all">
                <span>إضافة عنوان الآن</span>
                <span className="text-lg font-black">+</span>
              </div>
            </motion.div>
          )}

          <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
            * يتم استخدام عنوانك ورقم هاتفك حصراً لأغراض التوصيل والتواصل معك بخصوص طلبك عبر الواتساب.
          </p>
        </section>

        <section className="space-y-4 animate-[fadeIn_0.6s_ease-out]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">طريقة الدفع</h3>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">المبلغ المطلوب</span>
              <span className="text-sm font-black text-primary">{total.toLocaleString()} د.ع</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {/* Zain Cash */}
            <button 
              onClick={() => setPaymentMethod('zain_cash')}
              className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                paymentMethod === 'zain_cash' 
                  ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                  : 'border-slate-100 dark:border-slate-800 bg-surface-light dark:bg-surface-dark hover:border-slate-200 dark:hover:border-slate-700 opacity-70'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-sm ${
                paymentMethod === 'zain_cash' ? 'bg-[#272727]' : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                <div className="w-6 h-6 rounded-full border-2 border-[#D6006E] flex items-center justify-center">
                  <div className="w-1 h-3 bg-white rotate-45"></div>
                </div>
              </div>
              <div className="flex flex-col text-right flex-1">
                <span className="font-bold text-base">زين كاش</span>
                <span className="text-[10px] text-slate-500 font-medium">الدفع السريع عبر المحفظة</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                paymentMethod === 'zain_cash' ? 'border-primary bg-primary' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {paymentMethod === 'zain_cash' && <Check size={14} className="text-white" strokeWidth={4} />}
              </div>
            </button>

            {/* Super Key */}
            <button 
              onClick={() => setPaymentMethod('super_key')}
              className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                paymentMethod === 'super_key' 
                  ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                  : 'border-slate-100 dark:border-slate-800 bg-surface-light dark:bg-surface-dark hover:border-slate-200 dark:hover:border-slate-700 opacity-70'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                paymentMethod === 'super_key' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <Key size={24} />
              </div>
              <div className="flex flex-col text-right flex-1">
                <span className="font-bold text-base">سوبر كي</span>
                <span className="text-[10px] text-slate-500 font-medium">دفع آمن عبر SuperKey</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                paymentMethod === 'super_key' ? 'border-primary bg-primary' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {paymentMethod === 'super_key' && <Check size={14} className="text-white" strokeWidth={4} />}
              </div>
            </button>

            {/* Cash on Delivery */}
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                paymentMethod === 'cash' 
                  ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                  : 'border-slate-100 dark:border-slate-800 bg-surface-light dark:bg-surface-dark hover:border-slate-200 dark:hover:border-slate-700 opacity-70'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                paymentMethod === 'cash' ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <Wallet size={24} />
              </div>
              <div className="flex flex-col text-right flex-1">
                <span className="font-bold text-base">دفع نقدي</span>
                <span className="text-[10px] text-slate-500 font-medium">الدفع مقدماً، يجب تسليم المبلغ خلال 3 أيام (في بغداد فقط)</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                paymentMethod === 'cash' ? 'border-primary bg-primary' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {paymentMethod === 'cash' && <Check size={14} className="text-white" strokeWidth={4} />}
              </div>
            </button>
          </div>
        </section>

        {/* Order Summary */}
        <section className="space-y-3 animate-[fadeIn_0.7s_ease-out]">
          <h3 className="text-lg font-bold tracking-tight">ملخص الطلب</h3>
          
          {/* Shipping Threshold Warning */}
          {shippingInfo && !shippingInfo.isThresholdMet && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 leading-relaxed">
                الحد الأدنى للطلب للشحن {shippingMethod === 'air' ? 'الجوي' : 'البحري'} هو {shippingInfo.threshold.toLocaleString()} د.ع. 
                مجموع طلبك الحالي هو {subtotal.toLocaleString()} د.ع. يرجى إضافة المزيد من المنتجات للمتابعة.
              </p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-[32px] p-5 border border-slate-100 dark:border-slate-800 space-y-3">
            {/* Items List */}
            <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700/50">
              {cartItems.map((item, idx) => (
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
                  <div className="text-xs font-black text-slate-900 dark:text-white shrink-0">
                    {((item.variant?.price || item.product.price) * item.quantity).toLocaleString()} د.ع
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">قيمة المنتجات ({cartItems.reduce((acc, item) => acc + item.quantity, 0)} قطع)</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{subtotal.toLocaleString()} د.ع</span>
            </div>
            {appliedCoupon ? (
              <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400 font-bold">
                <div className="flex items-center gap-1">
                  <Tag size={14} />
                  <span>خصم الكوبون ({appliedCoupon.code})</span>
                </div>
                <span>- {discountAmount.toLocaleString()} د.ع</span>
              </div>
            ) : hasAvailableCoupons ? (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-1.5 text-primary font-bold animate-pulse">
                  <Tag size={14} />
                  <span>يتوفر خصم لك!</span>
                </div>
                <Link to="/cart" className="text-[10px] text-slate-400 underline decoration-slate-300">استخدمه من السلة</Link>
              </div>
            ) : null}
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">الشحن الدولي</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{(shippingInfo?.internationalFee || 0).toLocaleString()} د.ع</span>
            </div>
            <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="font-black text-base text-slate-900 dark:text-white">المجموع الكلي</span>
              <div className="text-right">
                <span className="block text-2xl font-black text-primary tracking-tight">{total.toLocaleString()} د.ع</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-100 dark:bg-slate-800/50 p-3 rounded-2xl">
              * سيتم إرسال تكلفة الشحن إليك عبر رقم الواتساب الخاص بك قريباً جداً.
            </p>
          </div>
        </section>
      </main>

      {/* Payment Processing Overlay */}
      {isPlacingOrder && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="h-24 w-24 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
            <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            {paymentStep === 'success' && (
              <div className="absolute inset-0 flex items-center justify-center text-green-500 animate-in zoom-in duration-500">
                <CheckCircle2 size={48} />
              </div>
            )}
          </div>
          
          <h2 className="text-xl font-bold mb-2">
            {paymentStep === 'processing' && 'جاري إنشاء طلبك...'}
            {paymentStep === 'verifying' && 'يتم التحقق من العملية...'}
            {paymentStep === 'success' && 'تم إرسال طلبك بنجاح!'}
            {paymentStep === 'none' && 'جاري إنشاء طلبك...'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">يرجى عدم إغلاق الصفحة</p>
        </div>
      )}

      {/* Bottom Action Bar (Non-Sticky) */}
      <div className="relative mt-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-safe">
        <div className="w-full space-y-4">
          {/* Mandatory Checkbox and Policy Links */}
          <div className="bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center mt-0.5">
                <input 
                  type="checkbox" 
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="peer h-6 w-6 rounded-lg border-2 border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 checked:bg-primary checked:border-primary transition-all appearance-none cursor-pointer hover:border-primary/50"
                />
                <Check size={16} strokeWidth={4} className="absolute left-1 text-white opacity-0 peer-checked:opacity-100 transition-all scale-50 peer-checked:scale-100" />
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed select-none">
                أوافق على <Link to="/terms-of-service" className="text-primary hover:underline">شروط الخدمة</Link> و <Link to="/privacy-policy" className="text-primary hover:underline">سياسة الخصوصية</Link>، وأوافق على تزويدي بتكلفة الشحن الدولي عبر الواتساب للموافقة عليها قبل إتمام الشحن.
              </span>
            </label>
            
            <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
              <button onClick={() => navigate('/privacy-policy')} className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-colors">سياسة الخصوصية</button>
              <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
              <button onClick={() => navigate('/terms-of-service')} className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-colors">شروط الخدمة</button>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.15em] mb-0.5">المجموع الصافي</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{total.toLocaleString()}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase">د.ع</span>
              </div>
            </div>
            
            <button 
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || !selectedAddressId || !agreeToTerms || !!(shippingInfo && !shippingInfo.isThresholdMet)}
              className={`flex-1 relative h-14 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden
                ${isPlacingOrder || !selectedAddressId || !agreeToTerms || !!(shippingInfo && !shippingInfo.isThresholdMet)
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                  : 'bg-primary text-white shadow-[0_8px_25px_-5px_rgba(var(--primary-rgb),0.4)] hover:shadow-[0_12px_30px_-5px_rgba(var(--primary-rgb),0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] group'
                }`}
            >
              {isPlacingOrder ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                  <span className="animate-pulse">جاري الطلب...</span>
                </div>
              ) : (shippingInfo && !shippingInfo.isThresholdMet) ? (
                <span className="relative z-10">الطلب أقل من الحد الأدنى</span>
              ) : (
                <>
                  <span className="relative z-10">
                    {createdOrderId !== null ? 'تأكيد الدفع الآن' : 'تأكيد الطلب الآن'}
                  </span>
                  <div className="relative z-10 w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <ArrowLeft size={18} className="transform rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </div>
                  {/* Subtle Gradient Shine */}
                  {!agreeToTerms || isPlacingOrder || !selectedAddressId || !!(shippingInfo && !shippingInfo.isThresholdMet) ? null : (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  )}
                </>
              )}
            </button>
          </div>
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
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 shrink-0"></div>
            
            <div className="px-6 py-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">تغيير عنوان التوصيل</h3>
                <p className="text-xs text-slate-500 font-medium">اختر من عناوينك المحفوظة</p>
              </div>
              <button 
                onClick={() => navigate('/addresses/add', { state: { from: '/checkout/payment-address' } })}
                className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <MapPinPlus size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
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
            <div className="h-4 bg-white dark:bg-slate-900 shrink-0"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPaymentAddress;
