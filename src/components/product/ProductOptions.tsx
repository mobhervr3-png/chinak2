import React from 'react';
import { fixMojibake } from '../../utils/mojibakeFixer';

interface Option {
  id: number;
  name: string;
  values: string | string[];
}

interface ProductOptionsProps {
  options: Option[];
  selectedOptions: Record<string, string>;
  onOptionSelect: (optionName: string, value: string) => void;
  variants?: any[];
  onVariantSelect?: (combination: Record<string, string>) => void;
  selectedVariantId?: number | string;
}

const ProductOptions: React.FC<ProductOptionsProps> = ({
  options,
  selectedOptions,
  onOptionSelect,
  variants,
  onVariantSelect,
  selectedVariantId,
}) => {
  // Find selected variant image
  const selectedVariant = variants?.find(v => v.id === selectedVariantId);
  const selectedImage = selectedVariant?.image;

  // If variants are provided, render them as tags (New "Concept")
  if (variants && variants.length > 0 && onVariantSelect) {
    return (
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
            <h3 className="text-slate-900 dark:text-white text-sm font-black flex items-center gap-2">
              الخيارات المتاحة
              <span className="text-[10px] text-slate-400 font-normal">(اختر واحد)</span>
            </h3>
            
            {/* Selected Variant Thumbnail Display */}
            {selectedImage && (
                <div className="hidden">
                    {/* Thumbnail removed from here as requested, handled by main gallery */}
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(() => {
            // Deduplicate logic: Track seen labels
            const seenLabels = new Set<string>();
            
            return variants.map((variant, idx) => {
              // Parse combination if it's a string
              let combination = variant.combination;
              if (typeof combination === 'string') {
                try { combination = JSON.parse(combination); } catch { combination = {}; }
              }

              // Generate label from combination values
              const values: string[] = [];
              Object.values(combination).forEach((val: any) => {
                if (Array.isArray(val)) {
                  values.push(...val.map((v: any) => 
                    typeof v === 'object' ? (v.value || v.name || JSON.stringify(v)) : String(v)
                  ));
                } else if (typeof val === 'object' && val !== null) {
                  values.push(val.value || val.name || JSON.stringify(val));
                } else {
                  values.push(String(val));
                }
              });
              
              // Fix mojibake in values
              const fixedValues = values.map(v => fixMojibake(v));
              const label = fixedValues.join('، '); // Use Arabic comma

              // SKIP duplicates
              if (seenLabels.has(label)) return null;
              seenLabels.add(label);

              const isSelected = selectedVariantId ? variant.id === selectedVariantId : false;

              return (
                <button
                  key={variant.id || idx}
                  onClick={() => onVariantSelect(combination)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 text-right ${
                    isSelected
                      ? 'bg-white border-primary text-primary shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary/50'
                  }`}
                >
                  <span className="line-clamp-2 leading-4">{label}</span>
                </button>
              );
            });
          })()}
        </div>
      </div>
    );
  }

  // Fallback to original attribute-based selection
  if (!options || options.length === 0) return null;

  return (
    <div className="mb-6 space-y-6">
      {options.map((option) => {
        const values = typeof option.values === 'string' ? JSON.parse(option.values) : option.values;
        // Detect informational headers - Only if it has NO selectable values or is specifically named
        const isInformational = 
           (option.name === '免费服务' || 
           option.name === 'خدمات مجانية' || 
           option.name === 'خدمة مجانية' || 
           option.name === 'Free Service') && 
           (!values || values.length === 0);

        return (
          <div key={option.id} className="space-y-3">
            <h3 className="text-slate-900 dark:text-white text-sm font-black flex items-center gap-2">
              {fixMojibake(option.name)}
              {!isInformational && values && values.length > 0 && <span className="text-[10px] text-slate-400 font-normal">(اختر واحد)</span>}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {values && values.map((val: any) => {
                const rawValString = typeof val === 'object' ? (val.value || val.name || JSON.stringify(val)) : String(val);
                const valString = fixMojibake(rawValString);
                return (
                  <div
                    key={rawValString}
                    onClick={() => !isInformational && onOptionSelect(option.name, rawValString)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 text-right ${
                      isInformational
                        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        : selectedOptions[option.name] === rawValString
                          ? 'bg-white border-primary text-primary shadow-sm cursor-pointer'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary/50 cursor-pointer'
                    }`}
                  >
                    {valString}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductOptions;
