import React from 'react';
import { useNavigate } from 'react-router-dom';
import LazyImage from '../components/LazyImage';
import { 
  ChevronRight, 
  Truck, 
  Smile, 
  Rocket, 
  Package, 
  Target, 
  Eye, 
  ShoppingCart, 
  MapPin, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  Headphones, 
  MessageCircle, 
  Mail, 
  Phone 
} from 'lucide-react';

const AboutUs: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl pb-20 pb-safe pt-safe" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-50 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 border-b border-slate-100 dark:border-slate-800 justify-between h-14 pt-safe">
          <div className="w-10 flex justify-start">
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">من نحن</h2>
          <button 
            onClick={() => navigate(-1)}
            className="flex size-10 shrink-0 items-center justify-end text-[#0d141b] dark:text-white hover:opacity-70 transition-opacity"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Hero Section */}
        <div className="p-4">
          <div className="relative flex flex-col gap-6 rounded-xl items-center justify-center p-8 overflow-hidden min-h-[320px] shadow-sm">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
              <LazyImage 
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1000&auto=format&fit=crop" 
                alt="Global Shipping" 
                className="w-full h-full object-cover"
                isThumbnail={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101922]/90 via-[#101922]/40 to-[#101922]/40"></div>
            </div>

            <div className="flex flex-col gap-3 text-center z-10">
              <div className="w-16 h-16 bg-white rounded-xl mx-auto flex items-center justify-center mb-2 shadow-lg">
                <Truck className="text-primary" size={40} />
              </div>
              <h1 className="text-white text-3xl font-black leading-tight tracking-[-0.02em]">
                بوابتك للأسواق العالمية
              </h1>
              <h2 className="text-slate-200 text-base font-normal leading-relaxed max-w-xs mx-auto">
                نربط بين جودة الصناعة في الصين واحتياجاتك في العراق بأعلى معايير الأمان
              </h2>
            </div>
            <button 
              onClick={() => navigate('/support')}
              className="z-10 mt-2 flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary hover:bg-blue-600 text-white text-base font-bold leading-normal transition-all shadow-lg active:scale-95"
            >
              <span className="truncate">تواصل معنا</span>
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex min-w-[140px] flex-1 flex-col items-center gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
              <Smile className="text-primary mb-1" size={24} />
              <p className="text-2xl font-black leading-tight text-slate-900 dark:text-white">50k+</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">عميل سعيد</p>
            </div>
            <div className="flex min-w-[140px] flex-1 flex-col items-center gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
              <Rocket className="text-primary mb-1" size={24} />
              <p className="text-2xl font-black leading-tight text-slate-900 dark:text-white">٧-١٥ يوم</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">توصيل جوي</p>
            </div>
            <div className="flex min-w-[140px] flex-1 flex-col items-center gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
              <Package className="text-primary mb-1" size={24} />
              <p className="text-2xl font-black leading-tight text-slate-900 dark:text-white">1M+</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">منتج متنوع</p>
            </div>
          </div>
        </div>

        {/* Mission Section */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-6 w-1 rounded-full bg-primary"></span>
            <h2 className="text-[#0d141b] dark:text-white text-xl font-bold">مهمتنا ورؤيتنا</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Target size={20} />
                </div>
                <h3 className="font-bold text-lg">رسالتنا</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                تسهيل الوصول إلى أفضل المنتجات العالمية وتوفير تجربة تسوق آمنة وموثوقة للمستهلك العراقي، مع ضمان سرعة التوصيل وجودة الخدمة.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Eye size={20} />
                </div>
                <h3 className="font-bold text-lg">رؤيتنا</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                أن نكون المنصة الأولى والاختيار الأمثل للتجارة الإلكترونية العابرة للحدود في العراق، ونبني جسراً مستداماً بين المنتجين والمستهلكين.
              </p>
            </div>

            {/* Story Card */}
            <div className="md:col-span-2 flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
              <div 
                className="w-full aspect-video bg-cover bg-center rounded-lg" 
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format&fit=crop')` }}
              ></div>
              <div className="flex flex-col gap-2">
                <p className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight">تبسيط التجارة الإلكترونية</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed">
                  نحن نسعى لكسر الحواجز الجغرافية وتسهيل عملية التسوق من المتاجر الصينية مباشرة إلى باب منزلك في جميع محافظات العراق، مع ضمان الجودة وسرعة التوصيل.
                </p>
              </div>
              <button className="w-full mt-2 cursor-pointer items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[#0d141b] dark:text-white text-sm font-bold transition-colors">
                اقرأ المزيد عن قصتنا
              </button>
            </div>
          </div>
        </div>

        {/* How it works (Timeline) */}
        <div className="px-4 py-8 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 mb-8">
            <span className="h-6 w-1 rounded-full bg-primary"></span>
            <h2 className="text-[#0d141b] dark:text-white text-xl font-bold">كيف نعمل؟</h2>
          </div>
          <div className="relative flex flex-col gap-8 pr-2">
            {/* Line */}
            <div className="absolute right-[27px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
            
            {/* Step 1 */}
            <div className="relative flex items-start gap-4 z-10">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-2 border-primary shrink-0 shadow-sm">
                <ShoppingCart className="text-primary" size={24} />
              </div>
              <div className="flex flex-col pt-1">
                <h3 className="text-base font-bold text-[#0d141b] dark:text-white">اطلب منتجك</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">تصفح ملايين المنتجات واطلب ما تحب بسهولة.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start gap-4 z-10">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 shrink-0 shadow-sm text-slate-400">
                <Package size={24} />
              </div>
              <div className="flex flex-col pt-1">
                <h3 className="text-base font-bold text-[#0d141b] dark:text-white">المعالجة والشحن</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">نقوم بفحص ومتابعة شحنتك من الصين.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-start gap-4 z-10">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 shrink-0 shadow-sm text-slate-400">
                <MapPin size={24} />
              </div>
              <div className="flex flex-col pt-1">
                <h3 className="text-base font-bold text-[#0d141b] dark:text-white">التوصيل لباب المنزل</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">استلم طلبك في بغداد أو أي محافظة أخرى.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-6 w-1 rounded-full bg-primary"></span>
            <h2 className="text-[#0d141b] dark:text-white text-xl font-bold">قيمنا الجوهرية</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: ShieldCheck, title: 'الأمان المالي', desc: 'حماية كاملة لمدفوعاتك' },
              { icon: Zap, title: 'السرعة', desc: 'التزام بمواعيد التوصيل' },
              { icon: CheckCircle2, title: 'الجودة', desc: 'فحص دقيق للمنتجات' },
              { icon: Headphones, title: 'الدعم', desc: 'خدمة عملاء ٢٤/٧' }
            ].map((value, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                <value.icon className="text-primary" size={24} />
                <h4 className="font-bold text-sm">{value.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[10px]">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact & Footer */}
        <div className="p-8 flex flex-col gap-8 items-center text-center bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-32">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold">تواصل معنا</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">نحن هنا لمساعدتك في أي وقت</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/chats')}
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <MessageCircle size={24} />
            </button>
            <button 
              onClick={() => window.location.href = 'mailto:shanshel30@gmail.com'}
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Mail size={24} />
            </button>
            <button 
              onClick={() => window.location.href = 'tel:+8613223001309'}
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Phone size={24} />
            </button>
          </div>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex gap-4 text-xs font-bold text-primary">
              <button onClick={() => navigate('/privacy-policy')} className="hover:underline">سياسة الخصوصية</button>
              <span className="text-slate-300">|</span>
              <button onClick={() => navigate('/terms-of-service')} className="hover:underline">شروط الخدمة</button>
            </div>
            <p className="text-slate-400 text-xs">© 2024 جميع الحقوق محفوظة</p>
          </div>
        </div>
      </div>
  );
};

export default AboutUs;
