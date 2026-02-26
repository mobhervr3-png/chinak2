import React from 'react';
import { PackageSearch, FilterX } from 'lucide-react';

interface EmptyProductsStateProps {
  onResetFilters: () => void;
}

const EmptyProductsState: React.FC<EmptyProductsStateProps> = ({ onResetFilters }) => {

  return (
    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center mb-4 mx-auto">
        <PackageSearch size={40} className="text-slate-300" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">لم يتم العثور على منتجات</h3>
      <p className="text-sm text-slate-500 mb-6">جرب تغيير الفلاتر أو البحث عن شيء آخر</p>
      <button 
        onClick={onResetFilters}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-opacity mx-auto"
      >
        <FilterX size={20} />
        إعادة ضبط الفلاتر
      </button>
    </div>
  );
};

export default EmptyProductsState;
