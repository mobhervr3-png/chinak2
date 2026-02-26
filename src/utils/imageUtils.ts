/**
 * Utility to optimize Unsplash images and other image URLs
 */
export const optimizeUnsplashUrl = (url: string, width: number = 800, quality: number = 80) => {
  if (!url) return '';
  
  // If it's an Unsplash URL, we can use their API parameters
  if (url.includes('images.unsplash.com')) {
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?auto=format,compress&fit=crop&q=${quality}&w=${width}&fm=webp`;
  }
  
  // For other URLs, we just return as is (could add more providers later)
  return url;
};

/**
 * Get responsive image sizes for Unsplash
 */
export const getResponsiveUnsplashUrl = (url: string, size: 'small' | 'medium' | 'large' | 'thumbnail') => {
  const sizes = {
    thumbnail: 200,
    small: 400,
    medium: 800,
    large: 1200
  };
  
  return optimizeUnsplashUrl(url, sizes[size]);
};
