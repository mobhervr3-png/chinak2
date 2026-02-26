import React from 'react';
import { History, TrendingUp } from 'lucide-react';

interface SearchSuggestionsProps {
  recentSearches: string[];
  popularSearches: string[];
  onSelect: (query: string) => void;
  onClearRecent: () => void;
  onClose: () => void;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  recentSearches,
  popularSearches,
  onSelect,
  onClearRecent,
  onClose,
}) => {
  return (
    <>
      <div className="absolute top-full right-0 left-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 mx-4">
        {recentSearches.length > 0 && (
          <div className="p-4 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">الأبحاث الأخيرة</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClearRecent();
                }}
                className="text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors"
              >
                مسح الكل
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20"
                >
                  <History size={14} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">شائع الآن</h3>
          <div className="grid grid-cols-1 gap-1">
            {popularSearches.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-right transition-colors group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <TrendingUp size={18} />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div 
        className="fixed inset-0 z-[55] bg-black/5" 
        onClick={onClose}
      />
    </>
  );
};

export default SearchSuggestions;
