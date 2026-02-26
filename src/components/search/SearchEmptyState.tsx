import React from 'react';
import { History, Trash2, Eye, Flame } from 'lucide-react';

interface SearchEmptyStateProps {
  query: string;
  popularSearches: string[];
  recentSearches?: string[];
  onSelect: (query: string) => void;
  onClearRecent?: () => void;
}

const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({
  query,
  popularSearches,
  recentSearches = [],
  onSelect,
  onClearRecent,
}) => {
  if (query) return null;

  return (
    <div className="w-full flex flex-col gap-6 pt-2">
      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <History size={16} />
              <h3 className="text-sm font-medium">الأبحاث الأخيرة</h3>
            </div>
            {onClearRecent && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClearRecent();
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors max-w-full truncate"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Discovery/Popular Section */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Flame size={16} className="text-orange-500" />
            <h3 className="text-sm font-medium">اكتشف المزيد</h3>
          </div>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors">
            <Eye size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelect(s)}
              className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:border-primary/30 hover:text-primary transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchEmptyState;
