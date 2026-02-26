import React from 'react';
import { fixMojibake } from '../../utils/mojibakeFixer';

interface ProductDescriptionProps {
  productName?: string;
  description?: string;
  specs?: string | Record<string, any> | any[];
}

const ProductDescription: React.FC<ProductDescriptionProps> = ({
  productName,
  description,
  specs,
}) => {
  const hasSpecs = !!specs && (
    (typeof specs === 'string' && specs.trim().length > 0) ||
    (Array.isArray(specs) && specs.length > 0) ||
    (typeof specs === 'object' && Object.keys(specs).length > 0)
  );
  
  // Robust check for redundancy: remove all whitespace, colons, and punctuation, and convert to lowercase
  const normalize = (str: string | Record<string, any> | any[]) => {
    if (Array.isArray(str)) {
      return str.map(item => {
        if (typeof item === 'object') return Object.values(item).join('');
        return String(item);
      }).join('').toLowerCase().replace(/[\s:\-.,]+/g, '');
    }
    if (typeof str === 'object' && str !== null) {
      return Object.entries(str)
        .map(([k, v]) => `${k}${v}`)
        .join('')
        .toLowerCase()
        .replace(/[\s:\-.,]+/g, '');
    }
    return String(str || '').toLowerCase().replace(/[\s:\-.,]+/g, '');
  };
  
  const normalizedSpecs = hasSpecs ? normalize(specs!) : '';
  const normalizedDescription = normalize(description || '');
  const normalizedProductName = productName ? normalize(productName) : '';

  // Parse specs logic (similar to ProductSpecs)
  let parsedSpecs: { label: string; value: string }[] = [];
  if (hasSpecs) {
    let specsData = specs;
    if (typeof specs === 'string' && specs.trim().startsWith('{')) {
      try {
        specsData = JSON.parse(specs);
      } catch (e) {
        specsData = specs;
      }
    } else if (typeof specs === 'string' && specs.trim().startsWith('[')) {
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
       }).filter(item => item.value);
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
        .filter(item => item.value.length > 0);
    } else if (typeof specsData === 'object' && specsData !== null) {
      parsedSpecs = Object.entries(specsData)
        .map(([label, value]) => ({
          label: fixMojibake(label),
          value: fixMojibake(typeof value === 'object' ? JSON.stringify(value) : String(value))
        }));
    }
  }

  const isDescriptionRedundant = (hasSpecs && (
    normalizedDescription === normalizedSpecs || 
    normalizedSpecs.includes(normalizedDescription)
  )) || (!!productName && (
    normalizedDescription === normalizedProductName ||
    normalizedProductName.includes(normalizedDescription)
  )) || (normalizedDescription.length > 0 && normalizedDescription.length < 20 && hasSpecs && normalizedSpecs.includes(normalizedDescription));

  const showDescription = !!description && !isDescriptionRedundant;
  const showSpecsInDesc = parsedSpecs.length > 0;

  if (!showDescription && !showSpecsInDesc) return null;

  return (
    <div className="mb-8">
      {/* Description Section */}
      <section className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          <h3 className="text-slate-900 dark:text-white text-lg font-black">الوصف</h3>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-white/5">
          {showDescription && (
            <div className="text-slate-600 dark:text-slate-300 text-[15px] leading-loose whitespace-pre-line font-medium mb-6 last:mb-0">
              {fixMojibake(description)}
            </div>
          )}
          
          {showSpecsInDesc && (
            <div className="space-y-3">
              {parsedSpecs.map((spec, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                  {spec.label && (
                    <span className="text-slate-500 dark:text-slate-400 font-bold min-w-[120px]">
                      {spec.label}:
                    </span>
                  )}
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProductDescription;
