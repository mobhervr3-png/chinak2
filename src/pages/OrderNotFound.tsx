import React from 'react';
import { useNavigate } from 'react-router-dom';
import LazyImage from '../components/LazyImage';
import { ChevronRight, Search, Headphones } from 'lucide-react';

const OrderNotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white antialiased transition-colors duration-200 pt-safe" dir="rtl">
      {/* TopAppBar */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md px-4 py-3 pt-safe">
          {/* Back Button (RTL: points right for 'back') */}
          <button 
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight size={24} />
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">حالة الطلب</h1>
          {/* Spacer to balance the title centering */}
          <div className="size-10"></div>
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 flex flex-col items-center w-full px-4 pt-4 pb-8">
          {/* Illustration Area */}
          <div className="w-full flex justify-center py-8">
            <div className="relative flex items-center justify-center size-48 rounded-full bg-blue-50 dark:bg-slate-800/50">
              {/* Decorative background circle */}
              <div className="absolute inset-0 rounded-full border border-blue-100 dark:border-slate-700 animate-pulse"></div>
              {/* Main Illustration Image */}
              <LazyImage 
                src="https://img.freepik.com/free-vector/no-data-concept-illustration_114360-616.jpg" 
                alt="Order not found"
                className="size-40 object-contain relative z-10"
                isThumbnail={false}
              />
            </div>
          </div>

          {/* Headline Text */}
          <div className="w-full flex flex-col items-center text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              عذراً، لم نجد هذا الطلب
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed max-w-xs mx-auto">
              رقم الطلب الذي أدخلته غير صحيح أو غير موجود في سجلاتنا. يرجى التحقق والمحاولة مجدداً.
            </p>
          </div>

          {/* Search Field Section */}
          <div className="w-full max-w-7xl space-y-6">
            <label className="block group">
              <p className="text-slate-900 dark:text-slate-200 text-sm font-medium mb-2 pr-1">رقم الطلب</p>
              <div className="relative flex items-center">
                <input 
                  className="w-full h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-left dir-ltr font-medium tracking-wide" 
                  type="text" 
                  defaultValue="IQ-2023-9384"
                />
                {/* Action Icon inside input */}
                <div className="absolute left-3 flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
                  <Search size={20} />
                </div>
              </div>
            </label>
            {/* Primary Action Button */}
            <button className="w-full h-14 bg-primary hover:bg-blue-600 active:bg-blue-700 text-white text-base font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <span>بحث مرة أخرى</span>
            </button>
          </div>
        </main>

        {/* Footer / Secondary Action */}
        <footer className="p-6 pb-24 pb-safe w-full flex justify-center mt-auto">
          <button 
            onClick={() => navigate('/support')}
            className="flex items-center gap-2 text-primary dark:text-blue-400 font-medium text-sm py-2 px-4 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <Headphones size={20} />
            <span>هل تحتاج مساعدة؟ تواصل معنا</span>
          </button>
        </footer>
    </div>
  );
};

export default OrderNotFound;
