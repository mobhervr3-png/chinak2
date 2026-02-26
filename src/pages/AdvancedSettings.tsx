import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Bell, 
  Truck, 
  Tag, 
  Fingerprint, 
  ShieldCheck, 
  ChevronLeft, 
  Trash2 
} from 'lucide-react';

import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { clearCache } from '../services/api';

const AdvancedSettings: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [isClearing, setIsClearing] = React.useState(false);
  const [isDeleting, _setIsDeleting] = React.useState(false);
  
  const handleAccountDeletion = () => {
    navigate('/delete-account');
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      clearCache();
      // Add a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      showToast('تم مسح ذاكرة التخزين المؤقت بنجاح', 'success');
    } catch (err) {
      showToast('فشل مسح ذاكرة التخزين المؤقت', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const { 
    pushNotifications, 
    orderUpdates, 
    promotionalOffers, 
    biometricLogin, 
    toggleSetting
  } = useSettingsStore();
  
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-[#0d141b] dark:text-white antialiased pb-safe pt-safe" dir="rtl">
      {/* Top App Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md pt-safe">
          {/* Back Button (RTL: Arrow points right) */}
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowRight size={24} />
          </button>
          {/* Title */}
          <h1 className="text-lg font-bold leading-tight flex-1 text-center pr-2 pl-12">إعدادات متقدمة</h1>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 px-4 pb-8 space-y-6">
          {/* Section 1: Notifications */}
          <section>
            <h3 className="px-2 pb-2 pt-4 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">الإشعارات</h3>
            <div className="bg-white dark:bg-[#1C2632] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
              
              {/* Item: Push Notifications */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <Bell size={20} />
                  </div>
                  <span className="text-base font-medium">الإشعارات الفورية</span>
                </div>
                {/* Custom Toggle */}
                <div dir="ltr">
                  <label 
                    className={`relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none p-0.5 transition-colors duration-200 ${pushNotifications ? 'bg-primary justify-end' : 'bg-gray-200 dark:bg-gray-600 justify-start'}`}
                    onClick={() => toggleSetting('pushNotifications')}
                  >
                    <div className="h-[27px] w-[27px] rounded-full bg-white shadow-sm transform transition-transform"></div>
                    <input type="checkbox" className="invisible absolute" checked={pushNotifications} readOnly />
                  </label>
                </div>
              </div>

              {/* Item: Order Updates */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <Truck size={20} />
                  </div>
                  <span className="text-base font-medium">تحديثات الطلبات</span>
                </div>
                <div dir="ltr">
                  <label 
                    className={`relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none p-0.5 transition-colors duration-200 ${orderUpdates ? 'bg-primary justify-end' : 'bg-gray-200 dark:bg-gray-600 justify-start'}`}
                    onClick={() => toggleSetting('orderUpdates')}
                  >
                    <div className="h-[27px] w-[27px] rounded-full bg-white shadow-sm transform transition-transform"></div>
                    <input type="checkbox" className="invisible absolute" checked={orderUpdates} readOnly />
                  </label>
                </div>
              </div>

              {/* Item: Promotional Offers */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <Tag size={20} />
                  </div>
                  <span className="text-base font-medium">العروض الترويجية</span>
                </div>
                <div dir="ltr">
                  <label 
                    className={`relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none p-0.5 transition-colors duration-200 ${promotionalOffers ? 'bg-primary justify-end' : 'bg-gray-200 dark:bg-gray-600 justify-start'}`}
                    onClick={() => toggleSetting('promotionalOffers')}
                  >
                    <div className="h-[27px] w-[27px] rounded-full bg-white shadow-sm transform transition-transform"></div>
                    <input type="checkbox" className="invisible absolute" checked={promotionalOffers} readOnly />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Privacy & Security */}
          <section>
            <h3 className="px-2 pb-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">الخصوصية والأمان</h3>
            <div className="bg-white dark:bg-[#1C2632] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
              {/* Item: Biometric */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <Fingerprint size={20} />
                  </div>
                  <span className="text-base font-medium">تسجيل الدخول البيومتري</span>
                </div>
                <div dir="ltr">
                  <label 
                    className={`relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none p-0.5 transition-colors duration-200 ${biometricLogin ? 'bg-primary justify-end' : 'bg-gray-200 dark:bg-gray-600 justify-start'}`}
                    onClick={() => toggleSetting('biometricLogin')}
                  >
                    <div className="h-[27px] w-[27px] rounded-full bg-white shadow-sm transform transition-transform"></div>
                    <input type="checkbox" className="invisible absolute" checked={biometricLogin} readOnly />
                  </label>
                </div>
              </div>
              {/* Item: Permissions Link */}
              <button 
                onClick={() => showToast('هذه الميزة ستكون متوفرة قريباً', 'info')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <span className="text-base font-medium">إدارة أذونات البيانات</span>
                </div>
                <ChevronLeft size={20} className="text-gray-400" />
              </button>
            </div>
          </section>

          {/* Section 4: Data (Destructive) */}
          <section>
            <div className="bg-white dark:bg-[#1C2632] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 mt-2">
              <button 
                onClick={handleClearCache}
                disabled={isClearing}
                className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/40 transition-colors">
                    {isClearing ? (
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 size={20} />
                    )}
                  </div>
                  <span className="text-base font-medium text-red-600 dark:text-red-400">مسح ذاكرة التخزين المؤقت</span>
                </div>
              </button>

              {/* Item: Delete Account */}
              <button 
                onClick={handleAccountDeletion}
                disabled={isDeleting}
                className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group cursor-pointer border-t border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/40 transition-colors">
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 size={20} />
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-medium text-red-600 dark:text-red-400">حذف الحساب نهائياً</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                      سيتم مسح بياناتك الشخصية، سجل الطلبات، العناوين المسجلة، والمحفظة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    </span>
                  </div>
                </div>
                <ChevronLeft size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="mt-4 px-4">
              <a 
                href="https://chinak.com/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline py-2"
              >
                <ShieldCheck size={16} />
                <span>سياسة الخصوصية وشروط الخدمة</span>
              </a>
            </div>

            <p className="px-4 pt-4 text-xs text-gray-400 dark:text-gray-500 text-center pb-8">الإصدار 2.4.0 (Build 302)</p>
          </section>
        </main>
    </div>
  );
};

export default AdvancedSettings;
