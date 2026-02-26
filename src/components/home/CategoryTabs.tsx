import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon?: LucideIcon;
}

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onHoverCategory?: (id: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ 
  categories, 
  selectedCategoryId, 
  onSelectCategory,
  onHoverCategory
}) => {
  return (
    <div className="bg-background-light dark:bg-background-dark">
      <div className="flex overflow-x-auto scrollbar-hide py-3 px-4 gap-3">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              onMouseEnter={() => onHoverCategory?.(category.id)}
              className={`flex-none px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                selectedCategoryId === category.id
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {Icon && <Icon size={18} />}
                <span>{category.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryTabs;
