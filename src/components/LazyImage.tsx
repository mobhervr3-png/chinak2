import React, { useState, useEffect, useRef } from 'react';
import { ImageOff } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  quality?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  isThumbnail?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className = '',
  priority = false,
  width = 400,
  height,
  quality = 80,
  objectFit = 'cover',
  isThumbnail = false,
  onClick
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [failedProxy, setFailedProxy] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);

  // Optimize URLs and handle fallbacks using a global image proxy (weserv.nl)
  const optimizedSrc = React.useMemo(() => {
    // If proxy failed before, use original src
    if (failedProxy) return src;

    const devicePixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const baseWidth = isThumbnail ? Math.min(width, 320) : width;
    const finalWidth = Math.round(baseWidth * devicePixelRatio);
    const finalHeight = height ? Math.round(height * devicePixelRatio) : undefined;
    const finalQuality = isThumbnail ? Math.max(Math.min(quality, 85), 75) : quality;

    if (!src) return `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1560393464-5c69a73c5770&w=${finalWidth}&q=${finalQuality}&output=webp&fit=${objectFit}`;
    
    // If it's a data URL (base64), don't proxy it
    if (src.startsWith('data:')) {
      return src;
    }

    // Don't proxy local URLs or IPs as the proxy service can't reach them
    const isLocal = src.includes('localhost') || 
                   src.includes('127.0.0.1') || 
                   src.includes('10.0.2.2') ||
                   src.includes('192.168.');
    
    if (isLocal) {
      return src;
    }

    try {
      const cleanUrl = src.replace(/^https?:\/\//, '');
      let proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${finalWidth}&q=${finalQuality}&output=webp&fit=${objectFit}&il`;
      
      if (finalHeight) {
        proxyUrl += `&h=${finalHeight}`;
      }
      
      return proxyUrl;
    } catch (e) {
      console.warn('LazyImage: Failed to optimize URL', src, e);
      return src;
    }
  }, [src, width, height, quality, objectFit, isThumbnail, failedProxy]);

  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load images 200px before they come into view
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleImageError = () => {
    // If we haven't tried the original URL yet, try it now
    if (!failedProxy && optimizedSrc !== src) {
      console.warn(`LazyImage: Proxy failed for ${src}, falling back to original URL`);
      setFailedProxy(true);
      return;
    }

    // If original URL also fails, show error state
    setError(true);
    
    if (src && src.includes('unsplash.com')) {
      const fallbackUrl = `https://loremflickr.com/400/400/product?lock=${Math.floor(Math.random() * 1000)}`;
      console.warn(`LazyImage: Unsplash failed for ${src}, using fallback: ${fallbackUrl}`);
    }
  };

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden ${className} bg-slate-100 dark:bg-slate-800`}
      onClick={onClick}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          <img 
            src={`https://loremflickr.com/400/400/product?lock=${alt.length}`}
            alt="fallback"
            className="w-full h-full object-cover opacity-50 grayscale"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff size={24} className="text-slate-400" />
          </div>
        </div>
      ) : (
        (isInView || priority) && (
          <img
            src={optimizedSrc}
            alt={alt}
            decoding="async"
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectFit }}
          />
        )
      )}
    </div>
  );
};

export default LazyImage;
