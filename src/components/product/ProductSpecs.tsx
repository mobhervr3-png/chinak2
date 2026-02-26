import React from 'react';
import { fixMojibake } from '../../utils/mojibakeFixer';

interface ProductSpecsProps {
  specs?: string | Record<string, any>;
}

const ProductSpecs: React.FC<ProductSpecsProps> = ({ specs }) => {
  const hasSpecs = !!specs && (
    (typeof specs === 'string' && specs.trim().length > 0) ||
    (typeof specs === 'object' && Object.keys(specs).length > 0)
  );

  if (!hasSpecs) return null;

  let parsedSpecs: { label: string; value: string }[] = [];

  let specsData = specs;
  if (typeof specs === 'string' && specs.trim().startsWith('{')) {
    try {
      specsData = JSON.parse(specs);
    } catch (e) {
      specsData = specs;
    }
  }

  if (Array.isArray(specsData)) {
    parsedSpecs = specsData.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          label: fixMojibake(item.label || item.name || item.key || ''),
          value: fixMojibake(String(item.value || item.val || ''))
        };
      }
      return { label: '', value: fixMojibake(String(item)) };
    }).filter(item => item.value && item.value.length > 0);
  } else if (typeof specsData === 'string') {
    parsedSpecs = specsData.split('\n')
      .map(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          return {
            label: fixMojibake(parts[0].trim()),
            value: fixMojibake(parts.slice(1).join(':').trim())
          };
        }
        return { label: '', value: fixMojibake(line.trim()) };
      })
      .filter(item => {
        const label = item.label.toLowerCase();
        return item.value.length > 0 && 
               label !== 'price' && 
               label !== 'السعر' && 
               label !== 'price_rmb';
      });
  } else if (typeof specsData === 'object' && specsData !== null) {
    parsedSpecs = Object.entries(specsData)
      .filter(([key]) => {
        const label = key.toLowerCase();
        return label !== 'price' && 
               label !== 'السعر' && 
               label !== 'price_rmb';
      })
      .map(([label, value]) => ({
        label: fixMojibake(label),
        value: fixMojibake(typeof value === 'object' ? JSON.stringify(value) : String(value))
      }));
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-6 bg-primary rounded-full" />
        <h3 className="text-slate-900 dark:text-white text-lg font-black">المواصفات</h3>
      </div>
      
      <div className="flex flex-col space-y-3">
        {parsedSpecs.map((spec, index) => (
          <div 
            key={index} 
            className="flex flex-row items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300"
          >
            {spec.label ? (
              <>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-bold pl-4">{spec.label}</span>
                <span className="text-slate-900 dark:text-white text-sm font-bold text-left">{spec.value}</span>
              </>
            ) : (
              <span className="text-slate-900 dark:text-white text-sm font-bold w-full text-center">{spec.value}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductSpecs;
