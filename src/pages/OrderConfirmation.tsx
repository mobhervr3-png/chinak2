import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotificationStore } from '../store/useNotificationStore';
import LazyImage from '../components/LazyImage';

import { X, CheckCircle2, Truck, Headset } from 'lucide-react';

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;
  const addLocalNotification = useNotificationStore(state => state.addLocalNotification);

  useEffect(() => {
    // If no order in state, redirect to home
    if (!order) {
      navigate('/', { replace: true });
    }
  }, [order, navigate]);

  useEffect(() => {
    if (order?.id) {
      addLocalNotification({
        type: 'order',
        icon: 'check_circle',
        title: 'تم استلام طلبك! 🎉',
        description: `شكراً لتسوقك معنا. طلبك رقم #${order.id} بمبلغ ${order.total.toLocaleString()} د.ع قيد المراجعة الآن وسيتم تجهيزه للشحن قريباً. ستصلك رسالة عبر الواتساب قريباً بالتفاصيل.`,
        color: 'green',
        link: `/shipping-tracking?id=${order.id}`
      });
    }
  }, [order, addLocalNotification]);

  // If no order data, we might want to redirect or show a default state
  // but for now we'll just handle the display.

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl pb-safe pt-safe" dir="rtl">
      {/* TopAppBar */}
      <div className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 pt-safe">
        <div className="flex items-center px-4 py-3 justify-between">
          <div 
            onClick={() => navigate('/')}
            className="text-[#0d141b] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={24} />
          </div>
          <h2 className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">تأكيد الطلب</h2>
          <div className="size-12 shrink-0"></div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full px-4 pb-32 mx-auto">
        <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start md:pt-8">
          {/* Left Column: Status and Info */}
          <div className="flex flex-col items-center">
            {/* Hero Section (Success Animation) */}
            <div className="w-full flex flex-col items-center justify-center py-8">
              <div className="relative flex items-center justify-center size-32 rounded-full bg-primary/10 animate-[scaleIn_0.5s_ease-out_forwards]">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse"></div>
                <CheckCircle2 size={64} className="text-primary fill-primary/20" />
              </div>
            </div>

            {/* HeadlineText */}
            <div className="w-full text-center">
              <h1 className="text-[#0d141b] dark:text-white tracking-tight text-[32px] font-bold leading-tight px-4 pb-3 pt-2">شكراً لك!</h1>
            </div>

            {/* WhatsApp Notice Card */}
            <div className="w-full mb-8 animate-[fadeIn_0.6s_ease-out]">
              <div className="relative overflow-hidden bg-green-500/10 dark:bg-green-500/5 rounded-3xl border-2 border-green-500/20 p-6 flex flex-col items-center text-center gap-4">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/30">
                  <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                
                <div className="flex flex-col gap-1">
                  <h3 className="text-green-900 dark:text-green-300 font-bold text-lg">سيتم التواصل معك عبر الواتساب</h3>
                  <p className="text-green-800 dark:text-green-400 text-sm leading-relaxed">
                    سيتم إرسال تكلفة الشحن الكاملة إليك قريباً جداً عبر الواتساب.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary and Actions */}
          <div className="flex flex-col w-full">

            {/* Order Summary Card */}
            <div className="w-full bg-white dark:bg-[#1A2633] rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 mb-8">
              <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">رقم الطلب</p>
                <p className="font-bold text-slate-900 dark:text-white">#{order?.id || '---'}</p>
              </div>

              {/* Order Items List */}
              {order?.items && order.items.length > 0 && (
                <div className="flex flex-col gap-3 py-4 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal mb-1">المنتجات</p>
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <LazyImage 
                          src={item.variant?.image || item.product?.image} 
                          alt={item.product?.name}
                          className="w-full h-full"
                        />
                        <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black px-1 rounded-bl-md">
                          {item.quantity}x
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product?.name || item.name || 'منتج'}</p>
                        {( (item.variant && item.variant.combination) || item.selectedOptions || item.combination) && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(() => {
                              try {
                                const combination = item.selectedOptions 
                                  ? (typeof item.selectedOptions === 'string' ? JSON.parse(item.selectedOptions) : item.selectedOptions)
                                  : (item.variant && item.variant.combination
                                    ? (typeof item.variant.combination === 'string' ? JSON.parse(item.variant.combination) : item.variant.combination)
                                    : (typeof item.combination === 'string' ? JSON.parse(item.combination) : item.combination));
                                
                                if (!combination || Object.keys(combination).length === 0) {
                                  const rawCombination = item.selectedOptions || item.variant?.combination || item.combination;
                                  if (!rawCombination) return null;
                                  return (
                                    <span className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                                      {typeof rawCombination === 'string' ? rawCombination : JSON.stringify(rawCombination)}
                                    </span>
                                  );
                                }

                                return Object.entries(combination).map(([key, value]) => (
                                  <span key={key} className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                                    {key}: {String(value)}
                                  </span>
                                ));
                              } catch (e) {
                                const rawCombination = item.selectedOptions || item.variant?.combination || item.combination;
                                if (!rawCombination) return null;
                                return (
                                  <span className="text-[9px] bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                                    {typeof rawCombination === 'string' ? rawCombination : JSON.stringify(rawCombination)}
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white shrink-0">
                        {((item.price || item.variant?.price || item.product?.price || 0) * item.quantity).toLocaleString()} د.ع
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">طريقة الدفع</p>
                <p className="text-[#0d141b] dark:text-white text-sm font-bold text-left">
                  {order?.paymentMethod === 'zain_cash' ? 'زين كاش' : 
                   order?.paymentMethod === 'super_key' ? 'سوبر كي' : 
                   order?.paymentMethod === 'credit_card' ? 'بطاقة ائتمان' : 
                   order?.paymentMethod === 'cash' ? 'دفع نقداً' : (order?.paymentMethod || '---')}
                </p>
              </div>
              <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">مجموع المنتجات</p>
                <p className="text-[#0d141b] dark:text-white text-sm font-bold text-left">
                  {(order?.subtotal || (order?.total + (order?.discountAmount || 0)) || 0).toLocaleString()} د.ع
                </p>
              </div>
              <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">التوصيل المحلي</p>
                <p className="text-green-600 dark:text-green-400 text-sm font-bold">مجاني</p>
              </div>
              {order?.discountAmount > 0 && (
                <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">الخصم</p>
                  <p className="text-green-600 dark:text-green-400 text-sm font-bold">
                    - {order.discountAmount.toLocaleString()} د.ع
                  </p>
                </div>
              )}
              <div className="flex justify-between gap-x-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-primary/5 -mx-5 px-5">
                <p className="text-primary text-sm font-black">المبلغ الإجمالي</p>
                <p className="text-primary text-base font-black text-left">
                  {(order?.total || 0).toLocaleString()} د.ع
                </p>
              </div>
              <div className="flex justify-between gap-x-6 pt-3"> 
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">التوصيل المتوقع</p> 
                <div className="text-right"> 
                  <p className="text-[#0d141b] dark:text-white text-sm font-bold">
                    {order?.shippingMethod === 'sea' ? 'شهرين' : '7-15 يوم'}
                  </p> 
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {order?.shippingMethod === 'sea' ? 'شحن بحري من الصين' : 'شحن جوي من الصين'}
                  </p> 
                </div> 
              </div> 
            </div> 



            {/* Action Buttons */}
            <div className="w-full mt-auto flex flex-col gap-3">
              <button 
                onClick={() => navigate(`/shipping-tracking?id=${order?.id}`)}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] active:scale-95 transition-transform shadow-lg shadow-blue-200 dark:shadow-none"
              >
                <Truck size="20" className="ml-2" />
                <span className="truncate">تتبع حالة الطلب</span>
              </button>
              
              <button 
                onClick={() => navigate('/')}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold leading-normal tracking-[0.015em] active:scale-95 transition-transform"
              >
                العودة للتسوق
              </button>

              <button 
                onClick={() => navigate('/support')}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-transparent text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal tracking-[0.015em] active:opacity-70 transition-opacity"
              >
                <Headset size="18" className="ml-2" />
                <span className="truncate">هل تحتاج للمساعدة؟</span>
              </button>
            </div>
          </div>
        </div>
      </main> 
      
      {/* Bottom Spacer */} 
      <div className="h-5 bg-background-light dark:bg-background-dark"></div> 
    </div>
  );
};

export default OrderConfirmation;
