import React from 'react';
import { Construction } from 'lucide-react';
import PageTransition from '../components/PageTransition';

const Chat: React.FC = () => {
  return (
    <PageTransition>
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display items-center justify-center p-6 text-center pb-safe pt-safe" dir="rtl">
        <div className="w-full bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-700">
          <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">
            نحن نعمل على نظام المحادثة
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
            we're working on the chatting system
          </p>
        </div>
      </div>
    </PageTransition>
  );
};

export default Chat;
