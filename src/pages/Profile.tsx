import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Ticket, 
  MapPin, 
  ChevronLeft, 
  Heart, 
  Bell, 
  LayoutDashboard, 
  Headset, 
  HelpCircle, 
  Info, 
  LogOut,
  FileText,
  Trash2,
  Truck,
} from 'lucide-react';
import { updateProfile, fetchOrders, fetchAddresses, fetchCoupons, fetchMe } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useToastStore } from '../store/useToastStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTranslation } from 'react-i18next';
import DiscountPopup from '../components/DiscountPopup';
import ProfileHeader from '../components/ProfileHeader';
import { useCheckoutStore } from '../store/useCheckoutStore';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const subtotal = useCartStore((state) => state.getSubtotal());
  
  const { appliedCoupon, setAppliedCoupon } = useCheckoutStore();
  const [isDiscountPopupOpen, setIsDiscountPopupOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [addressCount, setAddressCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);

  const showToast = useToastStore((state) => state.showToast);
  const pushNotifications = useSettingsStore((state) => state.pushNotifications);
  const toggleSetting = useSettingsStore((state) => state.toggleSetting);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate('/login');
    }
  }, [user, isLoadingAuth, navigate]);

  useEffect(() => {
    if (user) {
      // Only set initial values if they are empty
      setEditName(prev => prev || user.name || '');
      setEditPhone(prev => prev || user.phone || '');
      setEditAvatar(prev => prev || user.avatar || '');
    }
  }, [user]); // Run when user object changes

  const loadData = useCallback(async () => {
    try {
      console.log('[Profile] Starting data load...');
      const results = await Promise.allSettled([
        fetchOrders(),
        fetchAddresses(),
        fetchCoupons(),
        fetchMe()
      ]);
      
      const orders = results[0].status === 'fulfilled' ? results[0].value : [];
      const addresses = results[1].status === 'fulfilled' ? results[1].value : [];
      const coupons = results[2].status === 'fulfilled' ? results[2].value : [];
      const freshUser = results[3].status === 'fulfilled' ? results[3].value : null;

      if (results[0].status === 'rejected') console.error('[Profile] Orders failed:', results[0].reason);
      if (results[1].status === 'rejected') console.error('[Profile] Addresses failed:', results[1].reason);
      if (results[2].status === 'rejected') console.error('[Profile] Coupons failed:', results[2].reason);
      if (results[3].status === 'rejected') console.error('[Profile] fetchMe failed:', results[3].reason);

      setOrderCount(Array.isArray(orders) ? orders.length : 0);
      setAddressCount(Array.isArray(addresses) ? addresses.length : 0);
      setCouponCount(Array.isArray(coupons) ? coupons.length : 0);
      
      if (freshUser) {
        updateUser(freshUser);
      }
    } catch (err: any) {
      console.error('[Profile] Unexpected error in loadData:', err);
      console.error('[Profile] Error message:', err.message);
      if (err.stack) console.error('[Profile] Error stack:', err.stack);
      showToast(t('common.error_loading'), 'error');
    }
  }, [updateUser, showToast, t]);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, loadData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    setError(null);
    try {
      const updatedUser = await updateProfile({ 
        name: editName, 
        avatar: editAvatar 
      });
      updateUser(updatedUser);
      setIsEditing(false);
      showToast(t('profile.update_success'), 'success');
    } catch (err: any) {
      setError(err.message || t('profile.update_failed'));
      showToast(t('profile.update_failed'), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full min-h-screen overflow-x-hidden group/design-root bg-background-light dark:bg-background-dark shadow-2xl pt-safe" dir="rtl">
      {/* Header / TopAppBar */}
        <div className="flex items-center bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md px-4 py-4 justify-between sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none border-b border-transparent dark:border-slate-800 transition-colors pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="w-8 h-8"></div>
          <h2 className="text-text-primary dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">{t('profile.title')}</h2>
          <div className="w-8 h-8"></div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-28 pb-safe">
          <ProfileHeader 
            user={user}
            isEditing={isEditing}
            editName={editName}
            setEditName={setEditName}
            editPhone={editPhone}
            editAvatar={editAvatar}
            setEditAvatar={setEditAvatar}
            error={error}
            updateLoading={updateLoading}
            handleUpdateProfile={handleUpdateProfile}
            handleImageChange={handleImageChange}
            setIsEditing={setIsEditing}
            setError={setError}
          />

          {/* Main Grid: ProfileStats & Navigation Groups */}
          <div className="px-4 md:px-6 md:grid md:grid-cols-2 md:gap-8 items-start">
            <div className="space-y-6">
              {/* Order Center (Modern) */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.orders')}</h3>
                  <button 
                    onClick={() => navigate('/orders')}
                    className="text-xs font-bold text-slate-400 flex items-center gap-1 active:opacity-70"
                  >
                    عرض الكل <ChevronLeft size={14} />
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  <div 
                    onClick={() => navigate('/orders?status=PENDING')}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="relative size-12 rounded-2xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400 group-active:scale-95 transition-all">
                      <ShoppingBag size={22} strokeWidth={1.5} />
                      {orderCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-slate-800">
                          {orderCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">قيد الانتظار</span>
                  </div>

                  <div 
                    onClick={() => navigate('/orders?status=SHIPPED')}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="relative size-12 rounded-2xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400 group-active:scale-95 transition-all">
                      <Truck size={22} strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">جاري الشحن</span>
                  </div>

                  <div 
                    onClick={() => setIsDiscountPopupOpen(true)}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="relative size-12 rounded-2xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400 group-active:scale-95 transition-all">
                      <Ticket size={22} strokeWidth={1.5} />
                      {couponCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-slate-800">
                          {couponCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">الكوبونات</span>
                  </div>

                  <div 
                    onClick={() => navigate('/favorites')}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="relative size-12 rounded-2xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400 group-active:scale-95 transition-all">
                      <Heart size={22} strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">المفضلة</span>
                  </div>
                </div>
              </div>

              {/* Account Settings */}
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] px-2 mb-3">{t('profile.account_settings')}</h3>
                <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <button 
                    onClick={() => navigate('/addresses')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-50 dark:border-slate-700/50 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                        <MapPin size={20} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.address_book')}</p>
                        <p className="text-[10px] text-slate-500">{t('profile.saved_addresses', { count: addressCount })}</p>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>

                  <button 
                    onClick={() => navigate('/favorites')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
                        <Heart size={20} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.favorites')}</p>
                        <p className="text-[10px] text-slate-500">{t('profile.interested_products')}</p>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Application Settings */}
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] px-2 mb-3">{t('profile.app_settings')}</h3>
                <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <div className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                        <Bell size={20} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.notifications')}</p>
                        <p className="text-[10px] text-slate-500">{t('profile.notifications_desc')}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={pushNotifications}
                        onChange={() => toggleSetting('pushNotifications')}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 mt-6 md:mt-0 pb-6">
              {/* Admin Section */}
              {user?.role === 'ADMIN' && (
                <div>
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.1em] px-2 mb-3">{t('profile.admin_section')}</h3>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl overflow-hidden border border-red-100 dark:border-red-900/20 shadow-sm">
                    <button 
                      onClick={() => navigate('/admin')}
                      className="w-full flex items-center justify-between p-4 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none group-hover:rotate-12 transition-transform">
                          <LayoutDashboard size={20} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">{t('profile.admin_dashboard_title')}</p>
                          <p className="text-[10px] text-red-500/70">{t('profile.admin_dashboard_desc')}</p>
                        </div>
                      </div>
                      <ChevronLeft size={20} className="text-red-300" />
                    </button>
                  </div>
                </div>
              )}

              {/* Support & About */}
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] px-2 mb-3">{t('profile.support_section')}</h3>
                <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <button 
                    onClick={() => navigate('/contact-us')}
                    className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 group-hover:scale-110 transition-transform">
                        <Headset size={20} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">اتصل بنا</p>
                        <p className="text-[10px] text-slate-500">تواصل مع الدعم الفني مباشرة</p>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>

                  <button 
                    onClick={() => navigate('/faq')}
                    className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <HelpCircle size={20} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.faq')}</p>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>

                  <button 
                    onClick={() => navigate('/privacy-policy')}
                    className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Info size={20} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">سياسة الخصوصية</p>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>

                  <button 
                    onClick={() => navigate('/terms-of-service')}
                    className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform">
                        <FileText size={20} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">شروط الخدمة</p>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>

                  <button 
                    onClick={() => navigate('/about-us')}
                    className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform">
                        <Info size={20} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.about_app')}</p>
                    </div>
                    <ChevronLeft size={20} className="text-slate-300 dark:text-slate-600" />
                  </button>



                  <button 
                    onClick={() => navigate('/delete-account')}
                    className="w-full flex items-center justify-between p-4 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <Trash2 size={20} />
                      </div>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400">حذف الحساب</p>
                    </div>
                    <ChevronLeft size={20} className="text-rose-300 dark:text-rose-800" />
                  </button>
                </div>
              </div>

              {/* Logout Section */}
              <div className="mt-8 px-2">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all active:scale-95 shadow-sm border border-rose-100/50 dark:border-rose-900/20"
                >
                  <LogOut size={20} />
                  {t('profile.logout')}
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-6 font-medium">Chinak v1.0.6</p>
              </div>
            </div>
          </div>
        </div>

      <DiscountPopup 
        isOpen={isDiscountPopupOpen}
        onClose={() => setIsDiscountPopupOpen(false)}
        onApply={(coupon) => setAppliedCoupon(coupon)}
        orderAmount={subtotal}
        appliedCoupon={appliedCoupon}
      />
    </div>
  );
};

export default Profile;
