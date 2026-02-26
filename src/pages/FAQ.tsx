import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight, Search, Headphones } from 'lucide-react';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onClick }) => {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button 
        onClick={onClick}
        className="w-full flex items-center justify-between py-5 text-right transition-colors"
      >
        <span className={`text-base font-bold ${isOpen ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
          {question}
        </span>
        <ChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-400'}`} size={24} />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

const FAQ: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'كم يستغرق التوصيل؟',
      answer: 'يستغرق التوصيل عادةً من 7 إلى 14 يوم عمل للطلبات الدولية من الصين، ومن 1 إلى 3 أيام عمل للطلبات المحلية داخل العراق.'
    },
    {
      question: 'كيف يمكنني تتبع طلبي؟',
      answer: 'يمكنك تتبع طلبك من خلال صفحة "تتبع الشحنة" في حسابك، حيث ستجد تحديثات مباشرة عن موقع شحنتك.'
    },
    {
      question: 'ما هي طرق الدفع المتوفرة؟',
      answer: 'نوفر طرق دفع متعددة تشمل الدفع عند الاستلام، زين كاش، والمحافظ الإلكترونية الأخرى، بالإضافة إلى بطاقات الائتمان.'
    },
    {
      question: 'هل يمكنني إرجاع المنتج؟',
      answer: 'نعم، يمكنك إرجاع المنتج خلال 3 أيام من تاريخ الاستلام إذا كان هناك عيب مصنعي أو إذا كان المنتج غير مطابق للمواصفات، بشرط أن يكون في حالته الأصلية.'
    },
    {
      question: 'هل تتوفر خدمة التوصيل لجميع المحافظات؟',
      answer: 'نعم، نوفر خدمة التوصيل لجميع محافظات العراق بما في ذلك إقليم كردستان والمناطق البعيدة.'
    },
    {
      question: 'كيف أتواصل مع خدمة العملاء؟',
      answer: 'يمكنك التواصل معنا عبر الدردشة المباشرة داخل التطبيق، أو عبر الواتساب، أو الاتصال بمركز خدمة العملاء المتاح على مدار 24 ساعة.'
    },
    {
      question: 'كيف يتم حماية بياناتي الشخصية؟',
      answer: 'نحن نولي خصوصية بياناتك أهمية قصوى. يتم تشفير جميع البيانات الشخصية والمعاملات المالية باستخدام أحدث تقنيات الأمان. يمكنك الاطلاع على تفاصيل أكثر في "سياسة الخصوصية" المتوفرة في صفحة الإعدادات.'
    }
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden font-display pb-safe pt-safe" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 h-16 flex items-center justify-between pt-safe">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-lg font-bold">الأسئلة الشائعة</h1>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          {/* Search Placeholder */}
          <div className="relative mb-8">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث عن سؤالك..."
              className="w-full h-12 pr-12 pl-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 outline-none focus:border-primary transition-colors text-sm"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-4 mb-6 no-scrollbar">
            {['الكل', 'الشحن', 'الدفع', 'الإرجاع', 'الحساب'].map((cat, i) => (
              <button 
                key={i}
                className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${i === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <FAQItem 
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>

          {/* Support CTA */}
          <div className="mt-12 p-6 rounded-3xl bg-primary/5 border border-primary/10 text-center">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Headphones size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">لم تجد إجابتك؟</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">فريق الدعم لدينا متاح دائماً لمساعدتك في أي استفسار</p>
            <button 
              onClick={() => navigate('/support')}
              className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all active:scale-95"
            >
              تواصل مع الدعم
            </button>
          </div>
        </main>
      </div>
  );
};

export default FAQ;
