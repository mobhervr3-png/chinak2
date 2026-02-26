import React from 'react';
import { useNavigate } from 'react-router-dom';
import LazyImage from '../components/LazyImage';
import { 
  ArrowRight, 
  Search, 
  MessageCircle, 
  Headphones, 
  Phone, 
  Truck, 
  Package, 
  ChevronLeft,
  UserCircle,
  Wallet,
  Undo2
} from 'lucide-react';

const CustomerSupport: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl pb-10 pb-safe pt-safe" dir="rtl">
        {/* Header / Navigation Bar */}
        <nav className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 -mr-2 text-slate-900 dark:text-white active:opacity-70"
            >
              <ArrowRight size={28} />
            </button>
            <h1 className="text-lg font-bold text-center flex-1 pr-2">مركز المساعدة</h1>
            {/* Spacer to balance the layout */}
            <div className="w-8"></div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex flex-col gap-6 pt-4">
          {/* Headline */}
          <div className="px-5">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">كيف يمكننا مساعدتك؟</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">اختر طريقة التواصل أو ابحث عن إجابة</p>
          </div>

          {/* Search Bar */}
          <div className="px-5">
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-primary">
                <Search size={20} />
              </div>
              <input 
                className="block w-full h-14 pr-12 pl-4 text-base rounded-2xl border-0 bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-slate-200 dark:ring-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary focus:bg-white dark:focus:bg-surface-dark transition-all text-right" 
                placeholder="ابحث عن سؤالك..." 
                type="text"
              />
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="px-5">
            <div className="grid grid-cols-3 gap-3">
              {/* Whatsapp */}
              <button className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-transform duration-200">
                <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                  <MessageCircle size={28} />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">واتساب</span>
              </button>
              {/* Live Chat */}
              <button 
                onClick={() => navigate('/chats')}
                className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-transform duration-200"
              >
                <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Headphones size={28} />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">دردشة</span>
              </button>
              {/* Call Us */}
              <button className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-transform duration-200">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary dark:text-blue-400">
                  <Phone size={28} />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">اتصل بنا</span>
              </button>
            </div>
          </div>

          {/* Recent Orders Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">الطلبات الأخيرة</h3>
              <button onClick={() => navigate('/orders')} className="text-primary text-sm font-medium">عرض الكل</button>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-4 px-5 pb-4 snap-x">
              {/* Order Card 1 */}
              <div className="snap-center shrink-0 w-[280px] bg-white dark:bg-surface-dark rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <LazyImage alt="Smart Watch" className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop" isThumbnail={true} />
                  </div>
                  <div className="flex flex-col flex-1 justify-center text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400">طلب #89203</span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">ساعة ذكية رياضية - أسود</h4>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 flex items-center justify-end gap-1">
                      تم الشحن
                      <Truck size={14} />
                    </span>
                  </div>
                </div>
                <button className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  إبلاغ عن مشكلة
                </button>
              </div>
              {/* Order Card 2 */}
              <div className="snap-center shrink-0 w-[280px] bg-white dark:bg-surface-dark rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <LazyImage alt="Headphones" className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop" isThumbnail={true} />
                  </div>
                  <div className="flex flex-col flex-1 justify-center text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400">طلب #89199</span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">سماعات رأس لاسلكية</h4>
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1 flex items-center justify-end gap-1">
                      قيد المعالجة
                      <Package size={14} />
                    </span>
                  </div>
                </div>
                <button className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  إبلاغ عن مشكلة
                </button>
              </div>
            </div>
          </section>

          {/* FAQ Categories */}
          <section className="px-5 pb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 text-right">الأسئلة الشائعة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                <FAQCategory 
                  icon={Truck} 
                  title="الشحن والتوصيل" 
                  subtitle="تتبع الشحنات، أوقات التسليم"
                  color="blue"
                />
                <FAQCategory 
                  icon={Wallet} 
                  title="الدفع والطلبات" 
                  subtitle="طرق الدفع، إلغاء الطلب"
                  color="blue"
                />
                <FAQCategory 
                  icon={Undo2} 
                  title="الاسترجاع والاستبدال" 
                  subtitle="سياسة الإرجاع، المبالغ المستردة"
                  color="orange"
                />
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                <FAQCategory 
                  icon={Wallet} 
                  title="الجمارك والرسوم" 
                  subtitle="الضرائب، رسوم الاستيراد للعراق"
                  color="indigo"
                />
                <FAQCategory 
                  icon={UserCircle} 
                  title="الحساب والخصوصية" 
                  subtitle="إدارة الحساب، سياسة الخصوصية"
                  color="blue"
                />
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="px-5 text-center mt-auto pb-6">
            <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">الدعم متاح 24/7 للإجابة على استفساراتكم</span>
            </div>
          </div>
        </main>
      </div>
  );
};

interface FAQCategoryProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color?: 'blue' | 'orange' | 'indigo';
}

const FAQCategory: React.FC<FAQCategoryProps> = ({ icon: Icon, title, subtitle, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/10 text-primary',
    orange: 'bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-500',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-500'
  };

  return (
    <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-right group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</span>
        </div>
      </div>
      <ChevronLeft className="text-slate-400 dark:text-slate-600 group-hover:text-primary transition-colors rtl:rotate-180" size={20} />
    </button>
  );
};

export default CustomerSupport;
