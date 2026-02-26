import React from 'react';

interface SearchLoadingStateProps {
  query: string;
}

const SearchLoadingState: React.FC<SearchLoadingStateProps> = ({ query }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium">جاري البحث عن "{query}"...</p>
    </div>
  );
};

export default SearchLoadingState;
