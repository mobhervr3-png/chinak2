import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Check, 
  Star, 
  FileEdit, 
  Link, 
  Laptop, 
  Package, 
  X, 
  Upload, 
  Eye, 
  EyeOff, 
  MessageSquareQuote, 
  Camera, 
  Edit3, 
  Trash2,
  Truck
} from 'lucide-react';
import ProductImageCarousel from './ProductImageCarousel';
import { calculateInclusivePrice } from '../../utils/shipping';
import type { Product } from '../../types/product';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggleSelection: (productId: number | string) => void;
  onUpdateStatus: (productId: number | string, data: any) => void;
  onUpdateOptions?: (productId: number | string, options: any[], variants: any[]) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: number | string) => void;
  onImportReviews: (product: Product) => void;
  onAddPictures: (product: Product) => void;
  checkPermission: (permission: string) => boolean;
  rates: {
    airRate: number;
    seaRate: number;
    minFloor: number;
  };
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onToggleSelection,
  onUpdateStatus,
  onUpdateOptions,
  onEdit,
  onDelete,
  onImportReviews,
  onAddPictures,
  checkPermission,
  rates
}) => {
  const { t } = useTranslation();
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [isEditingSize, setIsEditingSize] = useState(false);
  const [tempPrice, setTempPrice] = useState(product.price.toString());
  const [prevProductPrice, setPrevProductPrice] = useState(product.price);
  const [tempProductName, setTempProductName] = useState(product.name);
  const [prevProductName, setPrevProductName] = useState(product.name);
  const [tempWeight, setTempWeight] = useState(product.weight?.toString() || '');
  const [tempSize, setTempSize] = useState(`${product.length || 0}x${product.width || 0}x${product.height || 0}`);
  const [prevProductWeight, setPrevProductWeight] = useState(product.weight);
  const [prevProductSize, setPrevProductSize] = useState(`${product.length || 0}x${product.width || 0}x${product.height || 0}`);

  if (product.price !== prevProductPrice) {
    setPrevProductPrice(product.price);
    setTempPrice(product.price.toString());
  }

  if (product.name !== prevProductName) {
    setPrevProductName(product.name);
    setTempProductName(product.name);
  }

  if (product.weight !== prevProductWeight) {
    setPrevProductWeight(product.weight);
    setTempWeight(product.weight?.toString() || '');
  }

  const currentSize = `${product.length || 0}x${product.width || 0}x${product.height || 0}`;
  if (currentSize !== prevProductSize) {
    setPrevProductSize(currentSize);
    setTempSize(currentSize);
  }

  const options = Array.isArray(product.options) ? product.options : [];
  const variants = product.variants || [];
  const variantPrices = variants.map((v: any) => v.price).filter((p: any) => p > 0);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : product.price;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : product.price;
  const hasPriceRange = minPrice !== maxPrice;

  const { minInclusivePrice, maxInclusivePrice, hasInclusivePriceRange } = React.useMemo(() => {
    if (variants.length === 0) {
      const price = product.price;
      return { minInclusivePrice: price, maxInclusivePrice: price, hasInclusivePriceRange: false };
    }

    const inclusivePrices = variants.map((v: any) => v.price).filter((p: any) => p > 0);

    if (inclusivePrices.length === 0) {
       // Fallback if variants exist but have 0 price?
       // Use product price
       const price = product.price;
      return { minInclusivePrice: price, maxInclusivePrice: price, hasInclusivePriceRange: false };
    }

    const min = Math.min(...inclusivePrices);
    const max = Math.max(...inclusivePrices);
    return { minInclusivePrice: min, maxInclusivePrice: max, hasInclusivePriceRange: min !== max };
  }, [product, variants, rates]);


  const handleWeightSubmit = () => {
    const newWeight = parseFloat(tempWeight);
    if (!isNaN(newWeight) && newWeight !== product.weight) {
      const updates: any = { weight: newWeight };
      
      // Also update price immediately if RMB price is available
      if (product.basePriceIQD) {
        const newPrice = calculateInclusivePrice(
          product.price,
          product.domesticShippingFee || 0,
          product.basePriceIQD
        );
        if (newPrice !== product.price) {
          updates.price = newPrice;
        }
      }
      
      onUpdateStatus(product.id, updates);
    }
    setIsEditingWeight(false);
  };

  const handleSizeSubmit = () => {
    const parts = tempSize.toLowerCase().split('x');
    if (parts.length === 3) {
      const length = parseFloat(parts[0]);
      const width = parseFloat(parts[1]);
      const height = parseFloat(parts[2]);
      if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
        if (length !== product.length || width !== product.width || height !== product.height) {
          const updates: any = { length, width, height };
          
          // Also update price immediately if RMB price is available
          if (product.basePriceIQD) {
            const newPrice = calculateInclusivePrice(
              product.price,
              product.domesticShippingFee || 0,
          product.basePriceIQD
        );
            if (newPrice !== product.price) {
              updates.price = newPrice;
            }
          }
          
          onUpdateStatus(product.id, updates);
        }
      }
    }
    setIsEditingSize(false);
  };
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<{ optionId: string, index: number } | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [tempName, setTempName] = useState('');

  const handlePriceSubmit = () => {
    const newPrice = parseFloat(tempPrice);
    if (!isNaN(newPrice) && newPrice !== product.price) {
      onUpdateStatus(product.id, { price: newPrice });
    }
    setIsEditingPrice(false);
  };

  const handleNameSubmitInline = () => {
    if (tempProductName.trim() && tempProductName !== product.name) {
      onUpdateStatus(product.id, { name: tempProductName.trim() });
    }
    setIsEditingName(false);
  };

  const handleNameSubmit = (optionId: string) => {
    if (!tempName.trim()) {
      setEditingName(null);
      return;
    }
    const newOptions = options.map((o: any) => 
      o.id === optionId ? { ...o, name: tempName.trim() } : o
    );
    if (onUpdateOptions) {
      onUpdateOptions(product.id, newOptions, product.variants || []);
    }
    setEditingName(null);
  };

  const handleValueSubmit = (optionId: string, index: number) => {
    if (!tempValue.trim()) {
      setEditingValue(null);
      return;
    }
    const option = options.find((o: any) => o.id === optionId);
    if (!option) return;

    let values = [];
    try {
      values = typeof option.values === 'string' ? JSON.parse(option.values) : option.values;
    } catch {
      values = [];
    }

    const newValues = [...values];
    newValues[index] = tempValue.trim();

    const newOptions = options.map((o: any) => 
      o.id === optionId ? { ...o, values: newValues } : o
    );

    if (onUpdateOptions) {
      onUpdateOptions(product.id, newOptions, product.variants || []);
    }
    setEditingValue(null);
  };

  const handleRemoveOptionValue = (optionId: string, valueToRemove: string) => {
    // Find the option by ID or fallback to matching by name if ID is missing (legacy)
    const option = options.find((o: any) => 
      (optionId && o.id === optionId) || (!o.id && !optionId)
    );
    if (!option) return;

    const optionName = option.name;
    
    // Ensure all options have parsed values and consistent IDs for mapping
    const parsedOptions = options.map((o: any) => {
      let vals = o.values;
      if (typeof vals === 'string') {
        try { vals = JSON.parse(vals); } catch { vals = []; }
      }
      return { ...o, values: Array.isArray(vals) ? vals : [] };
    });

    const targetOption = parsedOptions.find((o: any) => 
      (optionId && o.id === optionId) || (!o.id && !optionId)
    );
    if (!targetOption) return;

    const newValues = targetOption.values.filter((v: any) => 
      (typeof v === 'object' ? v.value : v) !== valueToRemove
    );
    
    if (newValues.length === 0) {
      handleRemoveOption(optionId);
      return;
    }

    const newOptions = parsedOptions.map((o: any) => {
      // If we're targeting this option, update its values
      const isTarget = (optionId && o.id === optionId) || (!o.id && !optionId && o.name === optionName);
      return isTarget ? { ...o, values: newValues } : o
    });

    // Ensure variants are parsed if they are strings
    let currentVariants = product.variants || [];
    if (typeof currentVariants === 'string') {
      try { currentVariants = JSON.parse(currentVariants); } catch { currentVariants = []; }
    }
    
    const newVariants = currentVariants.filter((v: any) => {
      let combination = v.combination;
      if (typeof combination === 'string') {
        try { combination = JSON.parse(combination); } catch { combination = {}; }
      }
      
      // Find the value in combination using a more robust match for the key
      const comboKey = Object.keys(combination).find(k => k.trim() === optionName.trim());
      const val = comboKey ? combination[comboKey] : null;
      
      const valString = typeof val === 'object' ? (val.value || val.name || JSON.stringify(val)) : String(val);
      return valString !== valueToRemove;
    });

    if (onUpdateOptions) {
      onUpdateOptions(product.id, newOptions, newVariants);
    }
  };

  const handleRemoveOption = (optionId: string) => {
    // Find the option by ID or fallback to matching by name if ID is missing (legacy)
    const option = options.find((o: any) => 
      (optionId && o.id === optionId) || (!o.id && !optionId)
    );
    if (!option) return;
    if (!window.confirm(`هل أنت متأكد من حذف خيار "${option.name}" بالكامل؟`)) return;
    
    const optionName = option.name;
    
    // Ensure all options have parsed values
    const parsedOptions = options.map((o: any) => {
      let vals = o.values;
      if (typeof vals === 'string') {
        try { vals = JSON.parse(vals); } catch { vals = []; }
      }
      return { ...o, values: Array.isArray(vals) ? vals : [] };
    });

    const newOptions = parsedOptions.filter((o: any) => 
      (optionId && o.id !== optionId) || (!optionId && o.name !== optionName)
    );
    
    // Ensure variants are parsed if they are strings
    let currentVariants = product.variants || [];
    if (typeof currentVariants === 'string') {
      try { currentVariants = JSON.parse(currentVariants); } catch { currentVariants = []; }
    }
    
    const processedVariants: any[] = [];
    const seenCombinations = new Set();

    currentVariants.forEach((v: any) => {
      let combination = v.combination;
      if (typeof combination === 'string') {
        try { combination = JSON.parse(combination); } catch { combination = {}; }
      }
      
      const newCombination = { ...combination };
      // Robustly find and delete the key
      const comboKey = Object.keys(newCombination).find(k => k.trim() === optionName.trim());
      if (comboKey) {
        delete newCombination[comboKey];
      }
      
      const comboKeyStr = JSON.stringify(newCombination);
      if (!seenCombinations.has(comboKeyStr)) {
        seenCombinations.add(comboKeyStr);
        processedVariants.push({
          ...v,
          combination: newCombination
        });
      }
    });

    if (onUpdateOptions) {
      onUpdateOptions(product.id, newOptions, processedVariants);
    }
  };

  const handleAddOptionValue = (optionId: string, newValue: string) => {
    if (!newValue.trim()) return;
    
    // Ensure all options have parsed values
    const parsedOptions = options.map((o: any) => {
      let vals = o.values;
      if (typeof vals === 'string') {
        try { vals = JSON.parse(vals); } catch { vals = []; }
      }
      return { ...o, values: Array.isArray(vals) ? vals : [] };
    });

    const targetOption = parsedOptions.find((o: any) => o.id === optionId);
    if (!targetOption) return;

    if (!targetOption.values.includes(newValue.trim())) {
      const newValues = [...targetOption.values, newValue.trim()];
      const newOptions = parsedOptions.map((o: any) => 
        o.id === optionId ? { ...o, values: newValues } : o
      );
      if (onUpdateOptions) {
        onUpdateOptions(product.id, newOptions, product.variants || []);
      }
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all overflow-hidden group relative ${
      !product.isActive && product.status !== 'DRAFT'
        ? 'opacity-60 grayscale border-slate-200 dark:border-slate-700' 
        : 'border-slate-100 dark:border-slate-700/50'
    } ${isSelected ? 'ring-2 ring-primary border-primary/20 bg-primary/5' : ''}`}>
      
      {/* Selection Checkbox */}
      <div className={`absolute top-4 right-4 z-10 transition-opacity ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(product.id);
          }}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-slate-200 text-transparent'
          }`}
        >
          <Check size={16} />
        </button>
      </div>

      <div className="p-4 flex gap-4 flex-row-reverse items-start">
        <ProductImageCarousel 
          images={Array.isArray(product.images) ? product.images : []} 
          mainImage={product.image} 
          isActive={product.isActive || product.status === 'DRAFT'} 
        />
        <div className="absolute top-1 right-1 flex flex-col gap-1 z-20">
          {product.isFeatured && (
            <div className="bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
              <Star size={10} fill="currentColor" />
              {t('dashboard.products.badges.featured')}
            </div>
          )}
          {product.status === 'DRAFT' && (
            <div className="bg-amber-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
              <FileEdit size={10} />
              DRAFT
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-start justify-between gap-2 mb-1 flex-row-reverse">
            <div className="flex-1 flex flex-col items-end min-w-0">
              {isEditingName && (product.status === 'DRAFT' || product.isLocal) ? (
                <input
                  type="text"
                  value={tempProductName}
                  onChange={(e) => setTempProductName(e.target.value)}
                  onBlur={handleNameSubmitInline}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSubmitInline()}
                  autoFocus
                  className="w-full px-2 py-1 text-sm font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                />
              ) : (
                <h4 
                  className={`text-sm font-bold text-slate-900 dark:text-white truncate w-full text-right ${(product.status === 'DRAFT' || product.isLocal) ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (product.status === 'DRAFT' || product.isLocal) {
                      setIsEditingName(true);
                    }
                  }}
                  title={(product.status === 'DRAFT' || product.isLocal) ? 'نقر مزدوج لتعديل الاسم' : ''}
                >
                  {product.name}
                </h4>
              )}
              {product.chineseName && (
                <span className="text-[10px] text-slate-400 font-bold font-sans truncate w-full text-right">{product.chineseName}</span>
              )}
              {product.purchaseUrl && (
                <div className="flex justify-end mt-1">
                  <a 
                    href={product.purchaseUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline font-sans"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link size={14} />
                    الرابط الأصلي
                  </a>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {product.isLocal && (
                <span className="text-[9px] font-black bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Laptop size={10} />
                  مسودة محلية
                </span>
              )}
              {product.status === 'DRAFT' && !product.isLocal && !product.isActive && (
                <span className="text-[9px] font-black bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded">{t('dashboard.products.badges.draft')}</span>
              )}
              {!product.isActive && (
                <span className="text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">{t('dashboard.products.badges.inactive')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2 flex-row-reverse">
            <Package size={14} />
            <span className="truncate">#{product.id}</span>
          </div>

          {/* Weight and Size Fields */}
          <div className="flex flex-wrap items-center justify-end gap-3 mb-2 flex-row-reverse">
            {/* Weight Field */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400">الوزن:</span>
              {isEditingWeight ? (
                <input
                  type="text"
                  value={tempWeight}
                  onChange={(e) => setTempWeight(e.target.value)}
                  onBlur={handleWeightSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleWeightSubmit()}
                  autoFocus
                  className="w-16 px-1 py-0.5 text-[10px] font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-md outline-none"
                />
              ) : (
                <div 
                  className="text-[10px] font-bold text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded border border-dashed cursor-pointer border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 transition-all"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingWeight(true);
                  }}
                  title="نقر مزدوج لتعديل الوزن"
                >
                  {product.weight || 0} كغم
                </div>
              )}
            </div>

            {/* Size Field */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400">المقاس:</span>
              {isEditingSize ? (
                <input
                  type="text"
                  value={tempSize}
                  onChange={(e) => setTempSize(e.target.value)}
                  onBlur={handleSizeSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleSizeSubmit()}
                  autoFocus
                  placeholder="LxWxH"
                  className="w-24 px-1 py-0.5 text-[10px] font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-md outline-none"
                />
              ) : (
                <div 
                  className="text-[10px] font-bold text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded border border-dashed cursor-pointer border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 transition-all"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingSize(true);
                  }}
                  title="نقر مزدوج لتعديل المقاس (L x W x H)"
                >
                  {product.length || 0}x{product.width || 0}x{product.height || 0}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between flex-row-reverse mb-2">
            <div className="flex flex-col items-end">
              {isEditingPrice && (product.status === 'DRAFT' || product.isLocal) ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">{t('common.iqd')}</span>
                  <input
                    type="number"
                    value={tempPrice}
                    onChange={(e) => setTempPrice(e.target.value)}
                    onBlur={handlePriceSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handlePriceSubmit()}
                    className="w-24 px-2 py-1 text-sm font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              ) : (
                <div 
                  className={`text-right ${(product.status === 'DRAFT' || product.isLocal) ? 'cursor-pointer hover:bg-primary/5 px-1 rounded transition-colors' : ''}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (product.status === 'DRAFT' || product.isLocal) {
                      setIsEditingPrice(true);
                    }
                  }}
                  title={(product.status === 'DRAFT' || product.isLocal) ? 'نقر مزدوج لتعديل السعر الأساسي' : ''}
                >
                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">
                    {t('common.base_price')}: {hasPriceRange ? (
                      `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} ${t('common.iqd')}`
                    ) : (
                      `${product.price.toLocaleString()} ${t('common.iqd')}`
                    )}
                  </p>
                  <div className="flex items-center gap-1 justify-end text-primary">
                    <Truck size={14} className="opacity-70" />
                    <p className="text-sm font-black">
                      {hasInclusivePriceRange ? (
                        `${minInclusivePrice.toLocaleString()} - ${maxInclusivePrice.toLocaleString()} ${t('common.iqd')}`
                      ) : (
                        `${minInclusivePrice.toLocaleString()} ${t('common.iqd')}`
                      )}
                    </p>
                  </div>
                  {(hasPriceRange || hasInclusivePriceRange) && (
                    <p className="text-[9px] text-slate-400 font-bold">يختلف حسب المتغير</p>
                  )}
                </div>
              )}
              {(product.basePriceRMB ?? 0) > 0 && (
                <p className="text-[10px] text-slate-400 font-bold font-sans">{(product.basePriceRMB ?? 0).toLocaleString()} RMB</p>
              )}
            </div>
          </div>

          {/* Product Options Display */}
          {product.options && product.options.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 justify-end">
              {product.options.map((opt: any) => {
                let values = [];
                try {
                  values = typeof opt.values === 'string' ? JSON.parse(opt.values) : opt.values;
                } catch {
                  values = [];
                }
                const isEditing = editingOptionId === opt.id;

                return (
                  <div key={opt.id} className="flex flex-col items-end gap-1.5 mb-1">
                    {editingName === opt.id ? (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => handleNameSubmit(opt.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit(opt.id)}
                        className="w-20 px-1 py-0.5 text-[10px] font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-md outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-1 group/opt">
                        {product.status === 'DRAFT' && (
                          <button
                            onClick={() => handleRemoveOption(opt.id)}
                            className="w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center opacity-0 group-hover/opt:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                            title="حذف الخيار بالكامل"
                          >
                            <X size={10} />
                          </button>
                        )}
                        <span 
                          className={`text-[11px] font-bold text-slate-500 dark:text-slate-400 ${product.status === 'DRAFT' ? 'cursor-pointer hover:text-primary' : ''}`}
                          onDoubleClick={() => {
                            if (product.status === 'DRAFT') {
                              setEditingName(opt.id);
                              setTempName(opt.name);
                            }
                          }}
                        >
                          {opt.name}:
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {values.map((v: any, idx: number) => {
                        const isEditingVal = editingValue?.optionId === opt.id && editingValue?.index === idx;
                        const valString = typeof v === 'object' ? (v.value || v.name || JSON.stringify(v)) : String(v);
                        
                        return isEditingVal ? (
                          <input
                            key={idx}
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => handleValueSubmit(opt.id, idx)}
                            onKeyDown={(e) => e.key === 'Enter' && handleValueSubmit(opt.id, idx)}
                            className="w-16 px-1 py-0.5 text-[9px] font-bold text-right bg-white dark:bg-slate-700 border border-primary rounded-md outline-none"
                          />
                        ) : (
                          <span 
                            key={idx} 
                            onDoubleClick={() => {
                              if (product.status === 'DRAFT') {
                                setEditingValue({ optionId: opt.id, index: idx });
                                setTempValue(valString);
                              }
                            }}
                            className="group/val relative text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 flex items-center gap-1 cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            {valString}
                            {product.status === 'DRAFT' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveOptionValue(opt.id, valString);
                                }}
                                className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover/val:opacity-100 transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                      {product.status === 'DRAFT' && (
                        isEditing ? (
                          <input
                            type="text"
                            placeholder="+ إضافة"
                            onBlur={() => setEditingOptionId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddOptionValue(opt.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                              } else if (e.key === 'Escape') {
                                setEditingOptionId(null);
                              }
                            }}
                            className="w-20 px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-700 border border-primary rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingOptionId(opt.id)}
                            className="text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 transition-colors"
                          >
                            + إضافة
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 flex-row-reverse">
        <div className="flex flex-wrap gap-2 flex-row-reverse justify-center sm:justify-start">
          {checkPermission('manage_products') && (
            <>
              {product.status === 'DRAFT' ? (
                <button
                  onClick={() => onUpdateStatus(product.id, { isActive: true, status: 'PUBLISHED' })}
                  className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-1 shadow-sm shrink-0"
                  title="نشر المنتج"
                >
                  <Upload size={16} />
                  نشر
                </button>
              ) : (
                <button
                  onClick={() => onUpdateStatus(product.id, { isActive: !product.isActive })}
                  className={`p-2 rounded-xl transition-colors shrink-0 ${
                    product.isActive 
                      ? 'text-slate-400 hover:bg-slate-200' 
                      : 'text-emerald-500 hover:bg-emerald-500/10'
                  }`}
                  title={product.isActive ? t('dashboard.products.tooltips.deactivate') : t('dashboard.products.tooltips.activate')}
                >
                  {product.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(product.id, { isFeatured: !product.isFeatured })}
                className={`p-2 rounded-xl transition-colors shrink-0 ${
                  product.isFeatured 
                    ? 'text-amber-500 hover:bg-amber-500/10' 
                    : 'text-slate-400 hover:bg-slate-200'
                }`}
                title={product.isFeatured ? t('dashboard.products.tooltips.unfeature') : t('dashboard.products.tooltips.feature')}
              >
                <Star size={20} fill={product.isFeatured ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onImportReviews(product)}
                className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-colors shrink-0"
                title="رفع التقييمات"
              >
                <MessageSquareQuote size={20} />
              </button>
              <button
                onClick={() => onAddPictures(product)}
                className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-colors flex items-center gap-1 shrink-0"
                title="إضافة صور المنتج"
              >
                <Camera size={20} />
                <span className="text-[10px] font-bold">صور</span>
              </button>
              <button
                onClick={() => onEdit(product)}
                className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors shrink-0"
                title={t('dashboard.products.tooltips.edit')}
              >
                <Edit3 size={20} />
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                title={t('dashboard.products.tooltips.delete')}
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
            #{product.id}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
