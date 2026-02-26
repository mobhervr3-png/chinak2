import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';

import { categories } from '../data/categories';

// Map specific JSON icon names to valid MDI icon names if they don't exist or need adjustment
const iconMapping: Record<string, string> = {
  // Fashion
  'women-fashion': 'face-woman',
  'dress': 'hanger',
  'tshirt-crew': 'tshirt-crew',
  'hoodie': 'tshirt-crew',
  'pants': 'hanger',
  'jeans': 'tag',
  'skirt': 'hanger',
  'human-female': 'account',
  'suit': 'briefcase-variant',
  'coat': 'tshirt-crew-outline',
  'swim': 'pool',
  'shoe-sneaker': 'shoe-sneaker',
  'boot': 'shoe-formal',
  'shoe-heel': 'shoe-heel',
  'shoe-flat': 'shoe-ballet',
  'shoe-sandal': 'shoe-print',
  'handbag': 'purse',
  'backpack': 'bag-personal',
  'wallet': 'wallet',
  'necklace': 'necklace',
  'watch': 'watch',
  'sunglasses': 'sunglasses',
  'socks': 'shoe-print', // MDI doesn't have socks
  'shirt': 'tshirt-crew', // MDI doesn't have shirt
  'belt': 'hanger', // Fallback to hanger as preferred by user
  'hat-fedora': 'hat-fedora',
  'tie': 'tie',
  'briefcase': 'briefcase',
  'belt': 'belt',
  'phone-case': 'cellphone-screenshot',
  'tablet': 'tablet-android',
  'home-lighting': 'home-lighting',
  'earring': 'earring',
  'jewelry-box': 'dresser-outline',
  'handbag': 'purse',
  'backpack': 'bag-personal',
  'pillow': 'bed-outline',
  'face-mask-outline': 'face-mask-outline',
  'face-mask': 'face-man-profile',
  'human-child': 'face-mask-outline',
  'scissors-cutting': 'content-cut',
  'sewing-machine': 'scissors-cutting',
  'cellphone-link': 'devices',
  'cellphone': 'cellphone',
  'shield-check': 'shield-check',
  'cable': 'usb-port',
  'power-plug': 'power-plug',
  'phone-in-hand': 'cellphone-check',
  'battery': 'battery',
  'battery-charging': 'battery-charging',
  'battery-high': 'battery',
  'plug': 'power-plug',
  'power-socket': 'power-socket-eu',
  'headphones': 'headphones',
  'watch-variant': 'watch',
  'speaker-wireless': 'speaker-bluetooth',
  'camera': 'camera',
  'drone': 'quadcopter',
  'laptop': 'laptop',
  'keyboard': 'keyboard',
  'usb': 'usb-flash-drive',
  'toaster': 'toaster',
  'blender': 'blender',
  'vacuum': 'vacuum',
  'fan': 'fan',
  'home-variant': 'home-variant',
  'lamp': 'lamp',
  'image': 'image',
  'flower': 'flower',
  'candle': 'candle',
  'clock': 'clock',
  'rug': 'rug',
  'silverware-fork-knife': 'silverware-fork-knife',
  'pot': 'pot',
  'silverware-fork': 'silverware-fork',
  'broom': 'broom',
  'bottle-tonic': 'bottle-tonic-plus',
  'spray-bottle': 'spray-bottle',
  'washing-machine': 'washing-machine',
  'air-filter': 'air-filter',
  'bed': 'bed',
  'towel': 'layers',
  'bathtub': 'bathtub',
  'curtains': 'blinds',
  'sofa': 'sofa',
  'desk': 'desk',
  'shelf': 'view-list',
  'face-woman': 'face-woman',
  'makeup': 'lipstick',
  'mirror': 'mirror',
  'eye': 'eye',
  'lips': 'lipstick',
  'hand-back-left': 'hand-back-left',
  'brush': 'brush',
  'shimmer': 'sparkles',
  'hair-dryer': 'hair-dryer',
  'lotion': 'bottle-tonic-plus',
  'sun-cream': 'bottle-tonic-plus',
  'oil': 'oil',
  'shampoo': 'bottle-tonic-plus',
  'spray': 'spray-bottle',
  'comb': 'brush',
  'perfume': 'bottle-tonic',
  'cologne': 'bottle-tonic',
  'baby-carriage': 'baby-carriage',
  'shirt-baby': 'baby-face-outline',
  'shirt-crew': 'tshirt-crew',
  'baby-face-outline': 'baby-face-outline',
  'ticket': 'baby-face-outline',
  'baby-bottle': 'baby-bottle',
  'bandage': 'bandage',
  'toy-brick': 'toy-brick',
  'school': 'school',
  'teddy-bear': 'toy-brick',
  'car-electric': 'car-electric',
  'tools': 'tools',
  'hammer': 'hammer',
  'drill': 'screwdriver',
  'pipe': 'pipe',
  'ruler': 'ruler',
  'toolbox': 'toolbox',
  'pencil-box': 'pencil-box',
  'pen': 'pen',
  'paperclip': 'paperclip',
  'book-open-variant': 'book-open-variant',
  'palette': 'palette',
  'folder-multiple': 'folder-multiple',
  'paw': 'paw',
  'dog-service': 'dog',
  'cat': 'cat',
  'fish': 'fish',
  'bird': 'bird',
  'rabbit': 'rabbit',
  'medical-bag': 'medical-bag',
  'heart-pulse': 'heart-pulse',
  'heart-monitor': 'heart-pulse',
  'water-percent': 'water-outline',
  'thermometer': 'thermometer',
  'wheelchair-accessibility': 'wheelchair',
  'lightbulb-variant': 'lightbulb-on',
  'ceiling-light': 'ceiling-light',
  'power-socket-eu': 'power-socket',
  'format-paint': 'format-paint',
  'ring': 'ring',
  'necklace': 'necklace',
  'watch': 'watch',
  'earring-variant': 'earring-variant',

  // Bags & Luggage
  'briefcase': 'briefcase-outline',
  'suitcase': 'briefcase', // Using standard briefcase as suitcase might be missing
  'bag-personal': 'bag-personal',

  // Smart Home
  'home-automation': 'home-automation',
  'cctv': 'camera-control',
  'lock-smart': 'lock-smart',
  'bell-ring': 'bell-ring',

  // Photography
  'video': 'video-outline',
  'microphone': 'microphone-variant',
  'white-balance-sunny': 'white-balance-sunny',

  // Party
  'party-popper': 'party-popper',
  'balloon': 'balloon',
  'cake-variant': 'cake-variant',

  // Sewing
  'needle': 'needle',
  'sewing-machine': 'scissors-cutting', // Using scissors as a more relevant fallback for sewing
  'scissors-cutting': 'content-cut',

  // Gaming
  'controller': 'controller-classic-outline',
  'mouse': 'mouse-variant',
  'led-strip-variant': 'led-strip',

  // Sub-category Additions Icons
  'tooth-outline': 'tooth-outline',
  'hair-dryer': 'hair-dryer',
  'watch-variant': 'watch-variant',
  'shower': 'shower',
  'dresser': 'dresser',
  'mask': 'face-mask-outline',
  'shield-check': 'shield-check',
  'yoga': 'yoga',
  'spade': 'spade',
  'faucet': 'faucet',
  'archive': 'archive',

  // Sports
  'dumbbell': 'dumbbell',
  'run': 'run',
  'swim': 'pool',
  'basketball': 'basketball',
  'bike': 'bicycle',
  'tent': 'tent',
  'bottle-water': 'cup-water', // Fix for reported issue

  // Toys
  'robot': 'robot',
  'film': 'filmstrip',
  'layers': 'layers',
  'cube': 'cube-outline',
  'model-text': 'toy-brick', // Fix for reported issue
  'remote': 'remote',

  // Automotive
  'car': 'car',
  'car-seat': 'car-seat',
  'spray': 'spray-bottle',

  // Fallbacks
  'box': 'package-variant',
  'gift': 'gift-outline',
};

const getIconClass = (iconName: string) => {
  if (!iconName) return 'mdi mdi-help-circle-outline';
  const mapped = iconMapping[iconName] || iconName;
  return `mdi mdi-${mapped}`;
};

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMainCategory, setSelectedMainCategory] = useState<number | null>(null);

  React.useEffect(() => {
    if (categories.length > 0 && selectedMainCategory === null) {
      setSelectedMainCategory(categories[0].id);
    }
  }, [categories, selectedMainCategory]);

  const selectedCategory = categories.find(c => c.id === selectedMainCategory);

  const handleSearch = (query: string) => {
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5" onClick={() => navigate('/search')}>
          <Search size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400 font-medium">ابحث عن منتجات...</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Main Categories */}
        <div className="w-[85px] h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 no-scrollbar pb-20">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => {
                if (selectedMainCategory === cat.id) {
                  handleSearch(cat.name_ar);
                } else {
                  setSelectedMainCategory(cat.id);
                }
              }}
              className={`relative flex flex-col items-center justify-center py-4 px-1 gap-1 transition-all cursor-pointer ${
                selectedMainCategory === cat.id
                  ? 'bg-white dark:bg-slate-900 text-primary font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {selectedMainCategory === cat.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
              )}
              {/* Icon placeholder */}
              <div className="size-8 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center overflow-hidden">
                 <i className={`${getIconClass(cat.icon)} text-xl text-slate-500 dark:text-slate-400 leading-none`} />
              </div>
              <span className="text-[10px] text-center leading-tight line-clamp-2">{cat.name_ar}</span>
            </div>
          ))}
          
          {/* Empty state placeholder */}
          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full p-2 text-center text-xs text-slate-400">
              <p>انتظار البيانات...</p>
            </div>
          )}
        </div>

        {/* Main Content - Subcategories */}
        <div className="flex-1 h-full overflow-y-auto bg-white dark:bg-slate-900 pb-20 p-4">
           {categories.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
               <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
               <p>بانتظار تحميل التصنيفات...</p>
             </div>
           ) : (
             <div className="space-y-6">
               {/* Subcategories */}
               {selectedCategory?.children?.map((subCat: any) => (
                 <div key={subCat.id} className="mb-6">
                   <div className="flex items-center justify-between mb-3">
                     <h3 
                       className="font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:text-primary transition-colors"
                       onClick={() => handleSearch(subCat.name_ar)}
                     >
                       {subCat.name_ar}
                     </h3>
                     <button 
                       className="text-xs text-primary flex items-center hover:underline"
                       onClick={() => handleSearch(subCat.name_ar)}
                     >
                       الكل <ChevronRight size={14} />
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                     {subCat.children?.map((item: any) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSearch(item.name_ar)}
                        >
                          {/* Item Icon Placeholder */}
                            <div className="size-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                              <i className={`${getIconClass(item.icon)} text-3xl text-primary leading-none`} />
                            </div>
                           <span className="text-[11px] text-center text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 w-full">
                            {item.name_ar}
                          </span>
                        </div>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Categories;
