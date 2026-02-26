import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Phone, 
  Mail, 
  MessageCircle, 
  MapPin, 
  Clock,
  Send
} from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

const ContactUs: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('تم إرسال رسالتك بنجاح. سنقوم بالرد عليك قريباً.', 'success');
    navigate(-1);
  };

  const contactMethods = [
    {
      icon: <Phone size={24} />,
      title: 'اتصل بنا',
      value: '+86 132 2300 1309',
      action: () => window.open('tel:+8613223001309'),
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: <MessageCircle size={24} />,
      title: 'واتساب',
      value: '+86 132 2300 1309',
      action: () => window.open('https://wa.me/8613223001309'),
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: <Mail size={24} />,
      title: 'البريد الإلكتروني',
      value: 'shanshel30@gmail.com',
      action: () => window.open('mailto:shanshel30@gmail.com'),
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white pb-24 pb-safe pt-safe" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pt-safe">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-xl font-bold">اتصل بنا</h1>
        </header>

        <main className="p-6">
          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-black mb-2">نحن هنا للمساعدة!</h2>
            <p className="text-slate-500 dark:text-slate-400">
              فريقنا جاهز للرد على استفساراتك وحل مشاكلك في أسرع وقت ممكن. يمكنك التواصل معنا بخصوص الطلبات، الاستفسارات، أو طلبات **الإرجاع والاستبدال**.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              {/* Quick Contact Methods */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-4">
                {contactMethods.map((method, index) => (
                  <button
                    key={index}
                    onClick={method.action}
                    className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all group"
                  >
                    <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${method.color} group-hover:scale-110 transition-transform`}>
                      {method.icon}
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">{method.title}</h3>
                      <p className="text-base font-black">{method.value}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Business Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl flex flex-col items-center text-center gap-2">
                  <MapPin className="text-slate-400" size={20} />
                  <p className="text-xs font-bold">العراق، بغداد، المنصور</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl flex flex-col items-center text-center gap-2">
                  <Clock className="text-slate-400" size={20} />
                  <p className="text-xs font-bold">9:00 ص - 10:00 م</p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <section className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 h-full">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Send size={20} className="text-primary" />
                أرسل لنا رسالة
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">الاسم بالكامل</label>
                  <input 
                    type="text" 
                    required
                    placeholder="أدخل اسمك هنا"
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">عنوان الرسالة</label>
                  <input 
                    type="text" 
                    required
                    placeholder="بماذا يمكننا مساعدتك؟"
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">تفاصيل الرسالة</label>
                  <textarea 
                    rows={4}
                    required
                    placeholder="اكتب رسالتك هنا بالتفصيل..."
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all mt-4"
                >
                  إرسال الرسالة
                </button>
              </form>
            </section>
          </div>
        </main>
    </div>
  );
};

export default ContactUs;
