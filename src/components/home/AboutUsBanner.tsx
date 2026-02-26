import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';

const AboutUsBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-4">
      <div className="relative overflow-hidden rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">بوابتك للأسواق العالمية</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">اكتشف من نحن وكيف نضمن لك أفضل تجربة تسوق</p>
          </div>
          <button 
            onClick={() => navigate('/about')}
            className="flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[10px] font-bold text-white shadow-sm active:scale-95 transition-transform"
          >
            اكتشف المزيد
          </button>
        </div>
        <div className="absolute -left-4 -top-4 opacity-10">
          <Globe size={60} />
        </div>
      </div>
    </div>
  );
};

export default AboutUsBanner;
