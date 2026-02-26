import React, { useState, useRef, useEffect } from 'react';
import LazyImage from '../LazyImage';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: { url: string }[];
  productName: string;
  hideIndicators?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, productName, hideIndicators }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shouldRender, setShouldRender] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  // Defer image rendering until after initial text mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 300); // 300ms delay to let text and layout render first
    return () => clearTimeout(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStart.current === null || touchEnd.current === null) return;
    const diff = touchStart.current - touchEnd.current;
    const minSwipeDistance = 30;

    if (Math.abs(diff) > minSwipeDistance) {
      const imagesCount = images.length;
      if (imagesCount > 1) {
        if (diff > 0) {
          // Swiped left (Next image)
          setActiveImageIndex(prev => (prev + 1) % imagesCount);
        } else {
          // Swiped right (Previous image)
          setActiveImageIndex(prev => (prev - 1 + imagesCount) % imagesCount);
        }
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    touchStart.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touchStart.current !== null) {
      touchEnd.current = e.clientX;
    }
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  if (!shouldRender) {
    return (
      <div className="relative w-full h-[350px] bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center transition-all duration-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-slate-400">جاري تجهيز الصور...</span>
        </div>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full h-[500px] bg-white dark:bg-slate-900 flex items-center justify-center">
        <ImageIcon size={48} className="text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] bg-white dark:bg-slate-900 overflow-hidden group">
      {/* Carousel Container */}
      <div 
        className="flex h-full transition-transform duration-500 ease-out cursor-grab active:cursor-grabbing"
        style={{ 
          transform: `translateX(-${activeImageIndex * 100}%)`, 
          width: '100%',
          direction: 'ltr' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {images.map((img, i) => (
          <div key={i} className="w-full h-full relative flex-shrink-0">
            <LazyImage 
              src={img.url} 
              alt={`${productName} - ${i + 1}`}
              width={800}
              objectFit="contain"
              className="w-full h-full select-none pointer-events-none"
              priority={i === 0 && shouldRender} // Only priority for first image after delay
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveImageIndex(prev => (prev - 1 + images.length) % images.length);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md text-slate-900 dark:text-white flex items-center justify-center z-20 transition-all hover:scale-110 active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveImageIndex(prev => (prev + 1) % images.length);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md text-slate-900 dark:text-white flex items-center justify-center z-20 transition-all hover:scale-110 active:scale-95"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Indicators */}
      {!hideIndicators && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 z-20">
          {images.map((_, i) => (
            <button 
              key={i}
              onClick={() => setActiveImageIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImageIndex ? 'w-6 bg-primary shadow-sm' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default ImageGallery;
