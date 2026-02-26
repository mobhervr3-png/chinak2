import React, { useEffect, useRef } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';

interface SearchHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onFocus: () => void;
  onClear: () => void;
  onSubmit?: () => void;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({
  query,
  onQueryChange,
  onBack,
  onFocus,
  onClear,
  onSubmit,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus immediately on mount with a small delay to ensure transition is done
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="sticky top-0 z-40 bg-white shadow-sm transition-all duration-300 dark:bg-slate-900 px-3 py-2">
      <div className="flex items-center gap-2">
        <button 
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowRight size={24} />
        </button>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (onSubmit) onSubmit();
            (document.activeElement as HTMLElement)?.blur();
          }}
          className="flex-1 relative group"
        >
          <div className="relative flex h-10 w-full items-center gap-2 rounded-full bg-slate-100 px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 dark:bg-slate-800">
            <Search size={18} className="text-slate-400" strokeWidth={2.5} />

            <input 
              ref={inputRef}
              className="flex-1 bg-transparent border-none p-0 text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 outline-none transition-all" 
              type="text" 
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={onFocus}
              placeholder="ابحث عن منتج..."
              enterKeyHint="search"
            />

            {query && (
              <button 
                type="button"
                onClick={onClear}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        <button 
          onClick={() => {
            if (onSubmit) onSubmit();
          }}
          className="h-10 px-4 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center"
        >
          بحث
        </button>
      </div>
    </div>
  );
};

export default SearchHeader;
