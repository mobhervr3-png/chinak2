import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Database, Share2, Lock, Eye, Bell } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: <Database className="text-blue-500" size={24} />,
      title: 'البيانات التي نجمعها',
      content: 'نجمع المعلومات التي تقدمها لنا عند التسجيل، مثل الاسم، البريد الإلكتروني، ورقم الهاتف، بالإضافة إلى عناوين الشحن لإتمام الطلبات.'
    },
    {
      icon: <Eye className="text-green-500" size={24} />,
      title: 'كيفية استخدام بياناتك',
      content: 'نستخدم بياناتك لمعالجة طلباتك، تحسين تجربتك في التطبيق، والتواصل معك بشأن حالة الطلب أو العروض الترويجية.'
    },
    {
      icon: <Share2 className="text-purple-500" size={24} />,
      title: 'مشاركة البيانات مع أطراف ثالثة',
      content: 'قد نشارك بياناتك مع شركاء الشحن وبوابات الدفع لإتمام عملية التوصيل والدفع فقط. نحن لا نبيع بياناتك لأي جهات إعلانية.'
    },
    {
      icon: <Lock className="text-orange-500" size={24} />,
      title: 'أمن المعلومات',
      content: 'نحن نتخذ إجراءات أمنية صارمة لحماية بياناتك من الوصول غير المصرح به أو التغيير أو الإفصاح عنها.'
    },
    {
      icon: <Bell className="text-red-500" size={24} />,
      title: 'حقوقك والتحكم في بياناتك',
      content: 'لك الحق في الوصول إلى بياناتك، تصحيحها، أو طلب حذف حسابك وبياناتك بالكامل في أي وقت من خلال إعدادات الملف الشخصي أو التواصل معنا.'
    }
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl pb-10 pb-safe pt-safe" dir="rtl">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pt-safe">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-xl font-bold">سياسة الخصوصية</h1>
        </header>

        <main className="p-6">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-2xl font-black mb-2">حماية خصوصيتك</h2>
            <p className="text-slate-500 dark:text-slate-400">
              نحن في "صينك" نلتزم بأعلى معايير الخصوصية لحماية بياناتك الشخصية.
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
              باستخدامك للتطبيق، فإنك توافق على سياسة الخصوصية الخاصة بنا.
            </p>
            <p className="text-xs text-slate-400 mt-4">آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
    </main>
  </div>
  );
};

export default PrivacyPolicy;
