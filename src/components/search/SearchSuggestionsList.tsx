import React from 'react';
import { Search } from 'lucide-react';

interface SearchSuggestionsListProps {
  query: string;
  onSelect: (query: string) => void;
}

const MOCK_SUGGESTIONS = [
  'ملابس أطفال',
  'ملابس أطفال أولاد',
  'ملابس رجالي',
  'ملابس نسائي',
  'ملابس أولاد كبار',
  'أحذية رياضية',
  'ساعات ذكية',
  'أيفون 15 برو',
  'سماعات بلوتوث',
  'ألعاب أطفال',
  'شنط نسائية',
  'عطور فرنسية'
];

const SearchSuggestionsList: React.FC<SearchSuggestionsListProps> = ({ query, onSelect }) => {
  // Filter suggestions based on query
  const filteredSuggestions = MOCK_SUGGESTIONS.filter(item => 
    item.includes(query) || query.split('').every(char => item.includes(char))
  );

  if (filteredSuggestions.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-slate-900">
      {filteredSuggestions.map((suggestion, index) => (
        <div 
          key={index}
          onClick={() => onSelect(suggestion)}
          className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
        >
          <Search size={16} className="text-slate-400" />
          <div 
            className="text-sm text-slate-700 dark:text-slate-200 flex-1 text-right"
            dangerouslySetInnerHTML={{
              __html: suggestion.replace(
                new RegExp(query, 'gi'),
                (match) => `<span class="text-slate-900 dark:text-white font-bold">${match}</span>`
              )
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default SearchSuggestionsList;
