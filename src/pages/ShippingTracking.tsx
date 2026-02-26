import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, 
  Bell, 
  CreditCard, 
  Wallet, 
  RefreshCw, 
  Calendar, 
  XCircle, 
  MapPin, 
  Copy, 
  Headset,
  ReceiptText,
  CheckCircle2,
  Package,
  Truck,
  PackageSearch,
  Home,
  X,
  Loader2,
  Phone
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { fetchOrderById, cancelOrder, confirmOrderPayment } from '../services/api';
import LazyImage from '../components/LazyImage';
import { useNotificationStore } from '../store/useNotificationStore';
import { useToastStore } from '../store/useToastStore';
import { useTranslation } from 'react-i18next';
import { socket, connectSocket } from '../services/socket';

const ShippingTracking: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'zain' | 'qi'>('zain');

  const unreadNotifications = useNotificationStore(state => state.unreadCount);

  const orderId = new URLSearchParams(location.search).get('id');

  const handlePaymentDone = async () => {
    if (!order || isConfirmingPayment) return;
    
    // Add confirmation dialog
    const isConfirmed = window.confirm('هل أنت متأكد أنك قمت بتحويل المبلغ؟');
    if (!isConfirmed) return;
    
    setIsConfirmingPayment(true);
    try {
      console.log(`[Payment] Confirming payment for order ${order.id}`);
      const result = await confirmOrderPayment(order.id);
      console.log(`[Payment] API Response:`, result);
      
      setPaymentDone(true);
      
      // Delay to show success animation/message
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentDone(false);
        setIsConfirmingPayment(false);
        showToast('شكراً لك! تم استلام طلب الدفع الخاص بك وجاري تجهيزه.', 'success');
        if (orderId) loadOrder(orderId); // Refresh order to show status update
      }, 3000);
    } catch (err: any) {
      console.error('[Payment] Failed to confirm payment:', err);
      showToast(err.message || 'فشل في تأكيد الدفع. يرجى المحاولة لاحقاً.', 'error');
      setIsConfirmingPayment(false);
    }
  };

  const generateTrackingEvents = useCallback((order: any) => {
    const events = [];
    const date = new Date(order.createdAt);
    const lang = 'ar-IQ';
    
    // Define logical status sequence
    const statusSequence = ['PENDING', 'AWAITING_PAYMENT', 'PREPARING', 'SHIPPED', 'ARRIVED_IRAQ', 'DELIVERED'];
    // Normalize status to uppercase for comparison
    let normalizedStatus = (order.status || 'PENDING').toUpperCase();
    if (normalizedStatus === 'NEED_PAYMENT') normalizedStatus = 'AWAITING_PAYMENT';

    const currentStatusIndex = statusSequence.indexOf(normalizedStatus);
    
    // Show up to current status + 1 for next step
    // But if it's PENDING (0), show only PENDING as requested
    const displayIndex = currentStatusIndex;
    
    // Helper to calculate date for future steps
    const getFutureDate = (hours: number) => {
      const d = new Date(date.getTime() + hours * 60 * 60 * 1000);
      return {
        time: d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }),
        date: d.toLocaleDateString(lang, { day: 'numeric', month: 'long' })
      };
    };

    // 1. Under Review (PENDING) - قيد المراجعة
    events.push({
      status: 'PENDING',
      title: t('status.pending'),
      description: t('tracking.status_desc_pending'),
      time: date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString(lang, { day: 'numeric', month: 'long' }),
      completed: currentStatusIndex > 0,
      active: currentStatusIndex === 0 || currentStatusIndex === -1,
      icon: ReceiptText
    });

    // 2. Awaiting Payment - بانتظار الدفع
    const paymentDates = getFutureDate(2);
    events.push({
      status: 'AWAITING_PAYMENT',
      title: t('status.awaiting_payment'),
      description: t('tracking.status_desc_awaiting_payment'),
      time: paymentDates.time,
      date: paymentDates.date,
      completed: currentStatusIndex > 1,
      active: currentStatusIndex === 1,
      icon: CreditCard
    });

    // 3. Preparing - قيد التجهيز
    const prepDates = getFutureDate(6);
    events.push({
      status: 'PREPARING',
      title: t('status.preparing'),
      description: t('tracking.status_desc_preparing'),
      time: prepDates.time,
      date: prepDates.date,
      completed: currentStatusIndex > 2,
      active: currentStatusIndex === 2,
      icon: Package
    });

    // 4. Shipped - تم الشحن
    const shipDates = getFutureDate(24);
    let arrivalMessage = '';
    const arrivalDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    if (order.shippingMethod === 'air') {
      arrivalDate.setDate(arrivalDate.getDate() + 12);
      arrivalMessage = `موعد الوصول المتوقع: ${arrivalDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}`;
    } else if (order.shippingMethod === 'sea') {
      arrivalDate.setMonth(arrivalDate.getMonth() + 2);
      arrivalMessage = `موعد الوصول المتوقع: ${arrivalDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}`;
    }

    events.push({
      status: 'SHIPPED',
      title: t('status.shipped'),
      description: arrivalMessage || t('tracking.status_desc_shipped'),
      time: shipDates.time,
      date: shipDates.date,
      completed: currentStatusIndex > 3,
      active: currentStatusIndex === 3,
      icon: Truck
    });

    // 5. Arrived to Iraq - وصل الى العراق
    const iraqDates = getFutureDate(48);
    events.push({
      status: 'ARRIVED_IRAQ',
      title: t('status.arrived_iraq'),
      description: t('tracking.status_desc_arrived_iraq'),
      time: iraqDates.time,
      date: iraqDates.date,
      completed: currentStatusIndex > 4,
      active: currentStatusIndex === 4,
      icon: PackageSearch
    });

    // 6. Delivered - تم التسليم
    const delDates = order.updatedAt ? {
      time: new Date(order.updatedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }),
      date: new Date(order.updatedAt).toLocaleDateString(lang, { day: 'numeric', month: 'long' })
    } : getFutureDate(72);
    
    events.push({
      status: 'DELIVERED',
      title: t('status.delivered'),
      description: t('tracking.status_desc_delivered'),
      time: delDates.time,
      date: delDates.date,
      completed: currentStatusIndex >= 5,
      active: currentStatusIndex === 5,
      icon: Home
    });

    // Only show events up to the current one + 1 (to show what's next)
    // or show all if it's already delivered
    if (normalizedStatus === 'DELIVERED') return events.reverse();
    
    // For other statuses, we generally want to show the current status and maybe the next one
    // But per request "only thing you should show when the order is made" (PENDING)
    // We stick to showing up to displayIndex (which is currentStatusIndex)
    // Actually, usually we show at least one more step to show progress direction
    // But I'll stick to displayIndex + 1 to keep the 'next step' visible but greyed out
    // UNLESS the user really wants to hide it.
    // "that's the only thing you should show when the order is made" -> strongly suggests hiding next steps for PENDING
    
    if (normalizedStatus === 'PENDING') {
      return events.slice(0, 1).reverse();
    }

    return events.slice(0, displayIndex + 1).reverse();
  }, [t]);

  const loadOrder = useCallback(async (id: number | string) => {
    try {
      const data = await fetchOrderById(id);
      // Enhance order with mock tracking events for realism
      const enhancedOrder = {
        ...data,
        trackingEvents: generateTrackingEvents(data)
      };
      setOrder(enhancedOrder);
    } catch (err) {
      console.error('Failed to load order:', err);
      showToast(t('tracking.order_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t, generateTrackingEvents]);

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
      
      // Real-time tracking updates
      connectSocket();
      
      const handleOrderUpdate = (data: any) => {
        console.log('Order status update received:', data);
        if (String(data.id || data.orderId) === String(orderId)) {
          loadOrder(orderId);
          showToast(t('tracking.status_updated_live'), 'info');
        }
      };

      // Listen for both the specific and general update events
      socket.on(`order_status_updated_${orderId}`, handleOrderUpdate);
      socket.on('order_status_update', handleOrderUpdate);

      return () => {
        socket.off(`order_status_updated_${orderId}`, handleOrderUpdate);
        socket.off('order_status_update', handleOrderUpdate);
      };
    }
  }, [orderId, loadOrder, showToast, t]);

  const handleCancelOrder = async () => {
    if (!order || !window.confirm(t('dashboard.orders.cancel_confirm'))) return;
    
    setIsCancelling(true);
    try {
      await cancelOrder(order.id);
      await loadOrder(order.id); // Reload to show updated status
      showToast(t('dashboard.orders.cancel_success'), 'success');
    } catch (err) {
      console.error('Failed to cancel order:', err);
      showToast(t('dashboard.orders.cancel_error'), 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark shadow-2xl font-display text-text-primary-light dark:text-text-primary-dark antialiased pb-safe pt-safe" dir="rtl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (!order) return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 text-center rtl pb-safe pt-safe" dir="rtl">
      <h2 className="text-xl font-bold mb-2">{t('tracking.order_not_found')}</h2>
      <button onClick={() => navigate('/orders')} className="text-primary font-bold">{t('tracking.back_to_orders')}</button>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-slate-100 antialiased selection:bg-primary/30 rtl pb-safe pt-safe" dir="rtl">
      <style>{`
        @keyframes pulse-ring {
            0% { transform: scale(0.33); }
            80%, 100% { opacity: 0; }
        }
        @keyframes pulse-subtle {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }
        @keyframes blink-opacity {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        .animate-blink {
            animation: blink-opacity 1s ease-in-out infinite;
        }
        .pulse-ring {
            position: absolute;
            left: 0;
            top: 0;
            display: block;
            width: 100%;
            height: 100%;
            border-radius: 9999px;
            box-shadow: 0 0 0 0 rgba(43, 140, 238, 0.7);
            animation: pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .animate-pulse-subtle {
            animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
      
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-4 justify-between border-b border-slate-200 dark:border-slate-800 transition-colors">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-slate-200 dark:active:bg-slate-700 transition-colors cursor-pointer"
          >
            <ChevronLeft size={24} className="transform rotate-180" />
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-2">{t('tracking.title')}</h2>
          <button 
            onClick={() => navigate('/notifications')}
            className="relative text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-slate-200 dark:active:bg-slate-700 transition-colors cursor-pointer"
          >
            <Bell size={24} />
            {unreadNotifications > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                {unreadNotifications}
              </span>
            )}
          </button>
        </header>

        {/* Main Content Container */}
        <div className="flex-1 w-full px-4 pb-32">
          <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start md:pt-8">
            {/* Left Column: Tracking Status and Events */}
            <div className="flex flex-col gap-6">
              {/* Need Payment Action Card */}
              {(order.status === 'NEED_PAYMENT' || order.status === 'AWAITING_PAYMENT') && (
                <div className="flex flex-col gap-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-5 border border-purple-200 dark:border-purple-800 shadow-sm animate-pulse-subtle">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-full bg-purple-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/30">
                      <CreditCard size={28} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-purple-900 dark:text-purple-300 text-lg font-bold">
                        {order.status === 'AWAITING_PAYMENT' ? 'بانتظار الدفع' : t('status.need_payment')}
                      </h3>
                      <p className="text-purple-700 dark:text-purple-400 text-sm leading-relaxed">
                        {order.status === 'AWAITING_PAYMENT' ? 'يرجى إتمام عملية الدفع لتأكيد طلبك وبدء التجهيز.' : t('tracking.status_desc_need_payment')}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowPaymentModal(true);
                    }}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-purple-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Wallet size={24} />
                    {t('tracking.pay_now')}
                  </button>
                </div>
              )}

              {/* Order Summary Card - Removed per request */}

              {/* Estimated Delivery */}
              {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 size-12">
                    <Calendar size={24} />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">{t('tracking.expected_arrival')}</p>
                    <p className="text-slate-900 dark:text-white text-lg font-bold leading-normal">
                      {(() => {
                        const baseDate = order.shippedAt ? new Date(order.shippedAt) : 
                                         order.updatedAt ? new Date(order.updatedAt) :
                                         new Date(new Date(order.createdAt).getTime() + 24 * 60 * 60 * 1000);
                        const arrivalDate = new Date(baseDate.getTime());
                        if (order.shippingMethod === 'air') {
                          arrivalDate.setDate(arrivalDate.getDate() + 12);
                        } else if (order.shippingMethod === 'sea') {
                          arrivalDate.setMonth(arrivalDate.getMonth() + 2);
                        }
                        return arrivalDate.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' });
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* Tracking Timeline */}
              <div className="flex flex-col gap-4">
                <h3 className="text-slate-900 dark:text-white text-lg font-bold px-1 pt-2">{t('tracking.route')}</h3>
                <div className="relative px-2 pb-6">
                  <div className="absolute top-2 bottom-0 right-[27px] w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>

                  {order.status === 'CANCELLED' ? (
                    <div className="relative flex gap-6 pb-8 z-10">
                      <div className="relative shrink-0 flex flex-col items-center">
                        <div className="size-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 z-10 relative">
                          <XCircle size={20} />
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col pt-1">
                        <p className="text-red-600 dark:text-red-400 text-base font-bold">{t('status.cancelled')}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('tracking.cancelled_text')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {order.trackingEvents?.map((event: any, idx: number) => (
                        <div key={idx} className={`relative flex gap-6 pb-8 z-10 ${(event.completed || event.active) ? 'opacity-100' : 'opacity-40'}`}>
                          <div className="relative shrink-0 flex flex-col items-center">
                            <div className={`size-10 rounded-full flex items-center justify-center text-white shadow-lg z-10 relative ${(event.completed || event.active) ? 'bg-primary shadow-primary/30' : event.status === 'OUT_FOR_DELIVERY' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-slate-300 dark:bg-slate-600'} ${event.active ? 'animate-blink' : ''}`}>
                              <event.icon size={20} />
                              {(event.active && order.status !== 'DELIVERED' && order.status !== 'CANCELLED') && (
                                <div className={`pulse-ring ${event.status === 'OUT_FOR_DELIVERY' ? 'bg-amber-500' : 'bg-primary'}`}></div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col pt-1">
                            <div className="flex justify-between items-start">
                              <p className={`text-base font-bold ${event.status === 'OUT_FOR_DELIVERY' && order.status === 'SHIPPED' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'} ${event.active ? 'animate-blink' : ''}`}>{event.title}</p>
                              {(event.completed || event.active) && (
                                <span className="text-[10px] text-slate-400 font-medium">{event.date} - {event.time}</span>
                              )}
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Order Details and Support */}
            <div className="flex flex-col gap-6">

          {/* Order Items Section */}
          <div className="flex flex-col gap-4 mt-2">
            <h3 className="text-slate-900 dark:text-white text-lg font-bold px-1">{t('tracking.order_contents')}</h3>
            <div className="flex flex-col gap-3">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <div className="size-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <LazyImage 
                      src={item.variant?.image || item.product.image} 
                      alt={item.product.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{item.product.name}</p>
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
                            // Fallback for non-JSON combination strings
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
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('tracking.qty')}: {item.quantity}</p>
                    <p className="text-sm font-bold text-primary">{item.price.toLocaleString()} {t('common.iqd')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('tracking.subtotal')}</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {order.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0).toLocaleString()} {t('common.iqd')}
              </span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400 font-bold">
                <div className="flex items-center gap-1">
                  <span>الخصم</span>
                  {order.couponCode && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">({order.couponCode})</span>}
                </div>
                <span>-{order.discountAmount.toLocaleString()} {t('common.iqd')}</span>
              </div>
            )}
            {order.internationalShippingFee > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400 font-bold">
                <span className="text-slate-500 dark:text-slate-400 font-normal">كلفة الشحن</span>
                <span>{order.internationalShippingFee.toLocaleString()} {t('common.iqd')}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-slate-900 dark:text-white">{t('tracking.total')}</span>
              <span className="text-lg font-bold text-primary">{order.total.toLocaleString()} {t('common.iqd')}</span>
            </div>
          </div>

          {/* Shipping Address Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
              <MapPin size={20} className="text-primary" />
              <h3>{t('tracking.address')}</h3>
            </div>
            {order.address ? (
              <div className="flex flex-col gap-1 pr-7">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{order.address.name}</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ltr" dir="ltr">
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/10 text-green-600">
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span>{order.address.phone}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {order.address.city}، {order.address.street}
                  {order.address.buildingNo && `، ${t('tracking.bldg')} ${order.address.buildingNo}`}
                  {order.address.floorNo && `، ${t('tracking.floor')} ${order.address.floorNo}`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 pr-7 italic">{t('tracking.no_address')}</p>
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-7"></div>
            <div className="flex items-center justify-between pr-7">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('tracking.shipping_method')}</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                {order.shippingMethod === 'air' ? t('tracking.air_shipping') : t('tracking.sea_shipping')}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
              <CreditCard size={20} className="text-primary" />
              <h3>{t('tracking.payment_method')}</h3>
            </div>
            <div className="flex items-center justify-between pr-7">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {order.paymentMethod === 'zain_cash' ? 'زين كاش' : 
                 order.paymentMethod === 'super_key' ? 'سوبر كي' : 
                 order.paymentMethod === 'cash' ? 'دفع نقدي' : 
                 order.paymentMethod === 'credit_card' ? 'بطاقة ائتمان' : (order.paymentMethod || '---')}
              </p>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 uppercase">
                {order.paymentMethod === 'cash' ? 'CASH' : (order.paymentMethod?.replace('_', ' ') || 'PAYMENT')}
              </span>
            </div>
          </div>



          {/* Actions */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm mt-4">
            <div className="flex gap-3">
              <button 
                onClick={async () => {
                  try {
                    await Clipboard.write({
                      string: `#IQ-${order.id}`
                    });
                    showToast(t('tracking.id_copied'), 'success');
                  } catch (err) {
                    console.error('Clipboard error:', err);
                    // Fallback to navigator if plugin fails
                    try {
                      await navigator.clipboard.writeText(`#IQ-${order.id}`);
                      showToast(t('tracking.id_copied'), 'success');
                    } catch (navErr) {
                      console.error('Navigator clipboard error:', navErr);
                    }
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold active:scale-95 transition-all"
              >
                <Copy size={20} />
                نسخ رقم الطلب
              </button>
              <button 
                onClick={() => window.open('https://wa.me/8613223001309', '_blank')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold shadow-lg shadow-green-500/25 active:scale-95 transition-all"
              >
                <Headset size={20} />
                الدعم الفني
              </button>
            </div>
            
            {order.status === 'PENDING' && (new Date().getTime() - new Date(order.createdAt).getTime() < 24 * 60 * 60 * 1000) && (
              <button 
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="w-full mt-3 py-3 text-red-500 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 active:bg-red-50 dark:active:bg-red-900/10 rounded-xl transition-all disabled:opacity-50"
              >
                {isCancelling ? <RefreshCw size={20} className="animate-spin" /> : <XCircle size={20} />}
                {t('tracking.cancel_order')}
              </button>
            )}

            <a 
              href="tel:07722177513"
              className="w-full mt-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Phone size={20} />
              اتصل بنا
            </a>
          </div>
        </div>
      </div>
    </div>

      {/* Payment Modal */}
      {showPaymentModal && order && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="w-full max-w-7xl bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500 border-t sm:border border-slate-200 dark:border-slate-800 rtl flex flex-col max-h-[95vh] pb-safe pt-safe"
            dir="rtl"
          >
            {/* Modal Handle (for mobile) */}
            <div className="w-full flex justify-center pt-3 sm:hidden">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Wallet size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">إتمام عملية الدفع</h3>
                  <p className="text-xs text-slate-500">طلب رقم #{order.id}</p>
                </div>
              </div>
              <button 
                onClick={() => !isConfirmingPayment && setShowPaymentModal(false)}
                className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {!paymentDone ? (
                <div className="flex flex-col gap-6">
                  {/* Amount Breakdown Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 dark:text-slate-400">قيمة المنتجات</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {order.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0).toLocaleString()} د.ع
                      </span>
                    </div>
                    
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
                        <span className="flex items-center gap-1">
                          الخصم
                          {order.couponCode && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">({order.couponCode})</span>}
                        </span>
                        <span>-{order.discountAmount.toLocaleString()} د.ع</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 dark:text-slate-400">كلفة الشحن</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {order.internationalShippingFee > 0 ? `${order.internationalShippingFee.toLocaleString()} د.ع` : 'مجاني'}
                      </span>
                    </div>

                    <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white">المجموع الكلي</span>
                      <div className="text-2xl font-black text-primary font-sans tracking-tight">
                        {order.total.toLocaleString()} <span className="text-sm">د.ع</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {order.paymentMethod !== 'cash' && (
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-primary"></div>
                        وسيلة الدفع المختارة:
                      </p>
                    )}

                    {/* Tabs - Hidden if specific method is selected */}
                    {!['zain_cash', 'super_key', 'cash'].includes(order.paymentMethod) && (
                      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                        <button 
                          onClick={() => setPaymentTab('zain')}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${paymentTab === 'zain' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          زين كاش
                        </button>
                        <button 
                          onClick={() => setPaymentTab('qi')}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${paymentTab === 'qi' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          سوبر كي
                        </button>
                      </div>
                    )}

                    <div className="mt-4">
                      {order.paymentMethod === 'cash' ? (
                        /* Cash Payment Warning */
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 animate-in fade-in zoom-in duration-300">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                              <Wallet size={24} />
                            </div>
                            <div className="flex flex-col">
                              <h4 className="text-base font-bold text-amber-900 dark:text-amber-200">الدفع النقدي</h4>
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                لقد اخترت الدفع نقداً عند التوصيل (في بغداد فقط).
                              </p>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border border-amber-100 dark:border-amber-900/30">
                            يرجى تجهيز المبلغ المذكور أعلاه. سيقوم مندوب التوصيل باستلام المبلغ عند تسليم الطلب.
                            <br/>
                            <span className="font-bold text-amber-600 dark:text-amber-400 block mt-1">
                              * لا يتطلب منك أي إجراء دفع إلكتروني الآن.
                            </span>
                          </div>
                        </div>
                      ) : (paymentTab === 'zain' || order.paymentMethod === 'zain_cash') && order.paymentMethod !== 'super_key' ? (
                        /* Zain Cash */
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-left-4 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">زين كاش (Zain Cash)</span>
                            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-bold">نشط</span>
                          </div>
                          <div className="aspect-square w-full max-w-[200px] mx-auto bg-white rounded-xl p-2 shadow-inner border border-slate-100 flex items-center justify-center overflow-hidden">
                            <img 
                              src="/assets/payment/zaincash_qr.png" 
                              alt="Zain Cash QR" 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                console.error('Failed to load ZainCash QR image');
                                e.currentTarget.src = 'https://placehold.co/400x400?text=ZainCash+QR';
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-center text-slate-500">قم بمسح الكود أعلاه عبر تطبيق زين كاش</p>
                        </div>
                      ) : (paymentTab === 'qi' || order.paymentMethod === 'super_key') && order.paymentMethod !== 'zain_cash' ? (
                        /* Qi Card */
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">سوبر كي (Super Ki)</span>
                            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-bold">نشط</span>
                          </div>
                          <div className="aspect-square w-full max-w-[200px] mx-auto bg-white rounded-xl p-2 shadow-inner border border-slate-100 flex items-center justify-center overflow-hidden">
                            <img 
                              src="/assets/payment/qicard_qr.png" 
                              alt="Qi Card QR" 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                console.error('Failed to load QiCard QR image');
                                e.currentTarget.src = 'https://placehold.co/400x400?text=QiCard+QR';
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-center text-slate-500">قم بمسح الكود أعلاه عبر تطبيق كي كارد</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Phone Number Info */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">يمكنك أيضاً الدفع عبر هذا الرقم:</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-primary font-sans" dir="ltr">07779786420</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('07779786420');
                          showToast('تم نسخ الرقم', 'success');
                        }}
                        className="text-xs bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 font-bold text-blue-600 dark:text-blue-400 active:scale-95 transition-all"
                      >
                        نسخ الرقم
                      </button>
                    </div>
                  </div>

                  {/* Warning Box */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      * يرجى الضغط على "تم التحويل" بعد إتمام العملية لكي يتم تحديث حالة طلبك.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-6 animate-bounce">
                    <CheckCircle2 size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">تم إرسال الطلب!</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-[250px]">
                    شكراً لك! لقد استلمنا إشعار الدفع الخاص بك. سيتم مراجعة العملية وتحديث حالة طلبك خلال دقائق.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              {!paymentDone ? (
                <div className="flex flex-col gap-3">
                  {order.paymentMethod !== 'cash' && (
                    <button 
                      onClick={handlePaymentDone}
                      disabled={isConfirmingPayment}
                      className="w-full py-4 bg-primary hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      {isConfirmingPayment ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={24} />
                          تم التحويل
                        </>
                      )}
                    </button>
                  )}
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    disabled={isConfirmingPayment}
                    className={`w-full py-3 ${order.paymentMethod === 'cash' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'} rounded-xl font-bold text-sm transition-all active:scale-[0.98]`}
                  >
                    {order.paymentMethod === 'cash' ? 'حسناً، فهمت' : 'إلغاء'}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98]"
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
);
};

export default ShippingTracking;
