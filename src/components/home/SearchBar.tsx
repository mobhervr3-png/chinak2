import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  onNavigate?: (path: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onNavigate
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const placeholders = [
    t('common.search_placeholder'),
    'الصق رابط تاوباو أو بيندودو هنا...',
    'Paste Taobao or Pinduoduo link...',
    'ابحث عن منتجاتك المفضلة...'
  ];

  useEffect(() => {
    if (inputValue) return; // Stop cycling if user is typing
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [placeholders.length, inputValue]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    // Check if it's a URL
    const isUrl = /^(http|https):\/\/[^ "]+$/.test(inputValue.trim());

    if (isUrl) {
      // Navigate to Agent Product Loading Page
      navigate(`/agent/product?url=${encodeURIComponent(inputValue.trim())}`);
    } else {
      setIsLoading(true); // Now used
      // Normal Search
      if (onNavigate) {
        onNavigate(`/search?q=${encodeURIComponent(inputValue.trim())}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(inputValue.trim())}`);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-white px-3 py-2 shadow-sm transition-all duration-300 dark:bg-slate-900">
      <form 
        onSubmit={handleSearch}
        className="relative flex h-10 w-full items-center gap-2 rounded-full bg-slate-100 px-4 transition-all focus-within:ring-2 focus-within:ring-primary-500 dark:bg-slate-800"
      >
        <Search size={18} className="text-slate-400 shrink-0" strokeWidth={2.5} />
        
        <div className="relative flex flex-1 items-center overflow-hidden h-full">
          <input
            type="text"
            className="h-full w-full bg-transparent text-sm text-slate-900 placeholder-transparent focus:outline-none dark:text-white"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            dir="auto"
          />
          
          <AnimatePresence mode="wait">
            {!inputValue && (
              <motion.span
                key={placeholderIndex}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none absolute left-0 right-0 truncate text-[13px] font-medium text-slate-400 text-right"
              >
                {placeholders[placeholderIndex]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {inputValue && (
          <button type="submit" className="text-primary-600 font-bold text-sm">
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'بحث'}
          </button>
        )}
      </form>
    </div>
  );
};

export default SearchBar;
