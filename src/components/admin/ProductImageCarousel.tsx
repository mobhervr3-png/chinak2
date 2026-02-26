import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LazyImage from '../LazyImage';

interface ProductImageCarouselProps {
  images: any[];
  mainImage: string;
  isActive: boolean;
}

const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({ images, mainImage, isActive }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayImages = (images && images.length > 0 ? images : [{ url: mainImage }]).map(img => {
    if (typeof img === 'string') return { url: img };
    return { url: img.url || img.image || mainImage };
  }).filter(img => img.url);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  if (displayImages.length === 0 && !mainImage) return null;

  return (
    <div className={`w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 relative group/carousel ${!isActive ? 'opacity-60 grayscale' : ''}`}>
      <LazyImage 
        className="w-full h-full object-cover transition-transform duration-500 group-hover/carousel:scale-110" 
        src={displayImages[currentIndex]?.url || mainImage} 
        alt="" 
        priority={true}
      />
      
      {displayImages.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
            <button 
              onClick={prevImage}
              className="w-5 h-5 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 shadow-sm"
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              onClick={nextImage}
              className="w-5 h-5 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 shadow-sm"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="absolute bottom-1 w-full flex justify-center gap-0.5 px-1">
            {displayImages.slice(0, 5).map((_, i) => (
              <div 
                key={i} 
                className={`h-0.5 rounded-full transition-all ${i === currentIndex ? 'w-2 bg-primary' : 'w-1 bg-white/50'}`}
              />
            ))}
            {displayImages.length > 5 && (
              <div className="w-1 h-0.5 rounded-full bg-white/30" />
            )}
          </div>
          <div className="absolute top-0 right-0 bg-black/50 text-white text-[8px] px-1 rounded-bl-lg">
            {currentIndex + 1}/{displayImages.length}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductImageCarousel;
