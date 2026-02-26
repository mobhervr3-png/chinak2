import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, ShoppingBag, Truck, CreditCard, UserCheck, AlertCircle } from 'lucide-react';

const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: <UserCheck className="text-blue-500" size={24} />,
      title: 'استخدام التطبيق',
      content: 'يجب أن يكون عمرك 18 عاماً على الأقل أو تستخدم التطبيق تحت إشراف ولي الأمر. أنت مسؤول عن الحفاظ على سرية حسابك وكلمة المرور.'
    },
    {
      icon: <ShoppingBag className="text-green-500" size={24} />,
      title: 'الطلبات والأسعار',
      content: 'نحن نحتفظ بالحق في رفض أو إلغاء أي طلب لأي سبب من الأسباب. الأسعار قابلة للتغيير دون إشعار مسبق، وتخضع المنتجات لمدى توفرها في المخزون.'
    },
    {
      icon: <Truck className="text-purple-500" size={24} />,
      title: 'الشحن والتوصيل',
      content: 'نسعى جاهدين لتوصيل الطلبات في أسرع وقت ممكن. مواعيد التوصيل هي تقديرية وقد تتأثر بظروف خارجة عن إرادتنا.'
    },
    {
      icon: <CreditCard className="text-orange-500" size={24} />,
      title: 'الدفع والاسترجاع',
      content: 'يتم قبول وسائل الدفع المحددة في التطبيق. سياسة الاسترجاع تخضع للقوانين المحلية وشروط الضمان المحددة لكل منتج.'
    },
    {
      icon: <AlertCircle className="text-red-500" size={24} />,
      title: 'إخلاء المسؤولية',
      content: 'نحن لا نضمن أن يكون التطبيق خالياً من الأخطاء أو الانقطاعات. نحن غير مسؤولين عن أي خسائر مباشرة أو غير مباشرة ناتجة عن استخدام التطبيق.'
    }
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display pb-10 pb-safe shadow-2xl pt-safe" dir="rtl">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pt-safe">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-xl font-bold">شروط الخدمة</h1>
        </header>

        <main className="p-6">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4">
              <FileText size={40} />
            </div>
            <h2 className="text-2xl font-black mb-2">اتفاقية الاستخدام</h2>
            <p className="text-slate-500 dark:text-slate-400">
              يرجى قراءة هذه الشروط بعناية قبل البدء باستخدام تطبيق "صينك".
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section, index) => (
              <div 
                key={index}
                className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 mb-3">
                  {section.icon}
                  <h3 className="text-lg font-bold">{section.title}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 p-6 bg-primary/5 rounded-3xl border border-primary/10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              استخدامك للتطبيق يعني موافقتك الصريحة على هذه الشروط والأحكام.
            </p>
            <p className="text-xs text-slate-400 mt-4">آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
    </main>
  </div>
  );
};

export default TermsOfService;
