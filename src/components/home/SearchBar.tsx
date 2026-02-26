import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Camera } from 'lucide-react';

interface SearchBarProps {
  onNavigate: (path: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onNavigate
}) => {
  const { t } = useTranslation();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const placeholders = [
    t('common.search_placeholder'),
    'ابحث عن أحدث الهواتف...',
    'عروض خاصة على الساعات الذكية',
    'أفضل أنواع العطور العالمية',
    'تسوق ملابس شتوية جديدة'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  return (
    <div className="sticky top-0 z-40 bg-white px-3 py-2 shadow-sm transition-all duration-300 dark:bg-slate-900">
      <div 
        onClick={() => onNavigate('/search')}
        className="relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-4 transition-all active:scale-[0.99] dark:bg-slate-800"
      >
        <Search size={18} className="text-slate-400" strokeWidth={2.5} />
        
        <div className="relative flex flex-1 items-center overflow-hidden h-full">
          <AnimatePresence mode="wait">
            <motion.span
              key={placeholderIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute w-full truncate text-[13px] font-medium text-slate-400 text-right"
            >
              {placeholders[placeholderIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
