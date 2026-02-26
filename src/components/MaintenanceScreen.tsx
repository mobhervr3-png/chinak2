import React from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import Logo from './Logo';
import { useMaintenanceStore } from '../store/useMaintenanceStore';

const MaintenanceScreen: React.FC = () => {
  const { lastError, lastUrl } = useMaintenanceStore();
  
  const handleRetry = () => {
    window.location.reload();
  };

  const handleSetLocalBackend = () => {
    const ip = prompt('Enter your PC Local IP (e.g., 192.168.1.5):');
    if (ip) {
      localStorage.setItem('api_url_override', `http://${ip}:5001`);
      window.location.reload();
    }
  };

  const handleClearOverride = () => {
    localStorage.removeItem('api_url_override');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6" dir="rtl">
      <div className="w-full max-w-7xl text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        
        <div className="flex justify-center">
          <div className="size-24 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center relative">
            <WifiOff className="text-orange-600 dark:text-orange-400" size={48} />
            <div className="absolute -top-1 -right-1 size-6 bg-red-500 rounded-full border-4 border-background-light dark:border-background-dark"></div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">عذراً، الخادم غير متوفر حالياً</h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            نواجه حالياً مشكلة في الاتصال بالخادم. قد يكون تحت الصيانة أو هناك مشكلة في الشبكة.
          </p>
        </div>

        {/* Diagnostic Information for Developers - Shown in DEV or if explicitly requested */}
        {(lastError || lastUrl) && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-right space-y-2 border border-red-100 dark:border-red-900/30">
            <div className="flex items-center justify-end gap-2 text-red-600 dark:text-red-400 font-bold mb-2">
              <span>معلومات التشخيص</span>
              <AlertCircle size={18} />
            </div>
            {lastUrl && (
              <div className="text-xs font-mono break-all opacity-80">
                <span className="font-bold">الرابط: </span>
                {lastUrl}
              </div>
            )}
            {lastError && (
              <div className="text-xs font-mono break-all text-red-700 dark:text-red-300">
                <span className="font-bold">الخطأ: </span>
                {lastError}
              </div>
            )}
            <div className="text-[10px] opacity-50 mt-2 font-mono">
              Mode: {import.meta.env.MODE} | Prod: {import.meta.env.PROD ? 'Yes' : 'No'}
            </div>
          </div>
        )}

        <div className="pt-4 space-y-4">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <RefreshCw size={20} />
              <span>إعادة المحاولة</span>
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleSetLocalBackend}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-medium"
              >
                اتصال محلي (IP)
              </button>
              {localStorage.getItem('api_url_override') && (
                <button
                  onClick={handleClearOverride}
                  className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium"
                >
                  حذف التجاوز
                </button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-slate-400 dark:text-slate-500">
            إذا استمرت المشكلة، يرجى التأكد من اتصالك بالإنترنت.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceScreen;
