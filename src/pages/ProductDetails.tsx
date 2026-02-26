import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { fetchProductById, fetchProductReviews, checkProductPurchase, findProductInGlobalCache, trackInteraction } from '../services/api';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { calculateInclusivePrice } from '../utils/shipping';
import { fixMojibake } from '../utils/mojibakeFixer';
import type { Product } from '../types/product';
import { Clipboard } from '@capacitor/clipboard';
import LazyImage from '../components/LazyImage';
import ProductHeader from '../components/product/ProductHeader';
import ImageGallery from '../components/product/ImageGallery';
import ProductInfo from '../components/product/ProductInfo';
import ProductDescription from '../components/product/ProductDescription';
import ProductSpecs from '../components/product/ProductSpecs';
import ReviewsSection from '../components/product/ReviewsSection';
import SimilarProducts from '../components/product/SimilarProducts';
import AddToCartBar from '../components/product/AddToCartBar';
import ProductActionSheet from '../components/product/ProductActionSheet';

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: { name: string };
  images?: string[];
}

import { AlertCircle, Package } from 'lucide-react';

const ProductDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const addItem = useCartStore((state) => state.addItem);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const showToast = useToastStore((state) => state.showToast);
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  
  const isProductInWishlist = (id: number | string) => wishlistItems.some(item => String(item.productId) === String(id));
  
  const [product, setProduct] = useState<Product | null>(() => {
    // 1. Try to get initial data from navigation state for instant rendering
    if (location.state && (location.state as any).initialProduct) {
      return (location.state as any).initialProduct;
    }
    // 2. Try to find in global cache (from Home page lists)
    if (productId) {
      const globalCached = findProductInGlobalCache(productId);
      if (globalCached) return globalCached;
    }
    return null;
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!product); // Only show loading if we don't have initial data
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  
  const [shouldRenderDetails, setShouldRenderDetails] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'air' | 'sea' | null>(null); // Default to null (user must select)
  const userChangedShipping = useRef(false);
  const [currentVariant, setCurrentVariant] = useState<any>(null);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    // Try to get initial options from navigation state or global cache
    const initialProd = (location.state as any)?.initialProduct || (productId ? findProductInGlobalCache(productId) : null);
    
    // Priority: Set options based on the cheapest variant to show the lowest price initially
    if (initialProd?.variants?.length > 0) {
      const minVariant = initialProd.variants.reduce((min: any, curr: any) => {
        if (!curr.price) return min;
        if (!min) return curr;
        return curr.price < min.price ? curr : min;
      }, null);

      if (minVariant?.combination) {
        try {
          const combination = typeof minVariant.combination === 'string' 
            ? JSON.parse(minVariant.combination) 
            : minVariant.combination;
          if (combination && Object.keys(combination).length > 0) {
            return combination;
          }
        } catch (e) {
          console.warn('Failed to parse minVariant combination', e);
        }
      }
    }

    // Fallback: Use first value of each option
    // Removed to ensure we default to the cheapest variant once full data is loaded
    // if (initialProd?.options?.length) {
    //   const options: Record<string, string> = {};
    //   initialProd.options.forEach((opt: any) => {
    //     try {
    //       const values = typeof opt.values === 'string' ? JSON.parse(opt.values) : opt.values;
    //       if (Array.isArray(values) && values.length > 0) {
    //         const firstVal = values[0];
    //         options[opt.name] = typeof firstVal === 'object' 
    //           ? (firstVal.value || firstVal.name || String(firstVal)) 
    //           : String(firstVal);
    //       }
    //     } catch (e) {
    //       // Ignore
    //     }
    //   });
    //   return options;
    // }
    return {};
  });

  // Effect to select the cheapest variant by default if no options are selected
  useEffect(() => {
    if (product?.variants?.length && Object.keys(selectedOptions).length === 0) {
      const minVariant = product.variants.reduce((min: any, curr: any) => {
        if (!curr.price) return min;
        if (!min) return curr;
        return curr.price < min.price ? curr : min;
      }, null);

      if (minVariant?.combination) {
        try {
          const combination = typeof minVariant.combination === 'string' 
            ? JSON.parse(minVariant.combination) 
            : minVariant.combination;
          if (combination && Object.keys(combination).length > 0) {
            setSelectedOptions(combination);
          }
        } catch (e) {
          console.warn('Failed to auto-select min variant', e);
        }
      }
    }
  }, [product, selectedOptions]);

  const allReviews = useMemo(() => reviews || [], [reviews]);

  const averageRating = useMemo(() => {
    if (!allReviews.length) return 0;
    return allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
  }, [allReviews]);

  const reviewSummary = useMemo(() => {
    if (!allReviews.length) return undefined;

    const summary: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let positiveCount = 0;
    const images: string[] = [];

    allReviews.forEach(r => {
      const rating = Math.round(r.rating);
      if (summary[rating] !== undefined) summary[rating]++;
      if (rating >= 4) positiveCount++;
      if (r.images && r.images.length > 0) {
        images.push(...r.images);
      }
    });

    const positiveRate = Math.round((positiveCount / allReviews.length) * 100) + '%';
    
    const tags = Object.entries(summary)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([rating, count]) => ({
        label: `${rating} نجوم`,
        count
      }));

    return {
      countText: allReviews.length.toString(),
      positiveRate,
      tags,
      images: images.slice(0, 10),
      comments: [], 
      reviews: [],
      detailedReviews: []
    };
  }, [allReviews]);

  const displaySpecs = useMemo(() => {
    if (!product) return [];
    
    // If we have a dedicated description field, return it first if specs are empty
    // But actually, the user said "product descriptions and features are stored in specs col"
    // So we should prioritize parsing specs correctly.
    
    const specs: any[] = [];
    // Parse specs if it's a string (JSON) or use as is if array
    if (product.specs) {
      if (Array.isArray(product.specs)) {
        specs.push(...product.specs);
      } else if (typeof product.specs === 'string') {
        try {
          // Check if it's a JSON string
          if (product.specs.trim().startsWith('{') || product.specs.trim().startsWith('[')) {
             const parsed = JSON.parse(product.specs);
             if (Array.isArray(parsed)) specs.push(...parsed);
             else Object.entries(parsed).forEach(([k, v]) => specs.push({ name: k, value: String(v) }));
          } else {
             // Treat as plain text description if not JSON
             // But ProductDescription expects an array or object for 'specs' prop to be treated as specs
             // If it's just a string, we might want to return it as a description-like object?
             // Or maybe ProductDescription handles string specs? Yes it does.
             // But here we are returning an array.
             // Let's just split by newlines if it looks like key-value pairs
             if (product.specs.includes(':')) {
                product.specs.split('\n').forEach(line => {
                  const parts = line.split(':');
                  if (parts.length >= 2) {
                    specs.push({ name: parts[0].trim(), value: parts.slice(1).join(':').trim() });
                  } else if (line.trim()) {
                    specs.push({ name: '', value: line.trim() });
                  }
                });
             } else {
                // Just a plain string description
                specs.push({ name: '', value: product.specs });
             }
          }
        } catch (e) {
           // Fallback for failed JSON parse -> treat as string
           if (typeof product.specs === 'string') {
              specs.push({ name: '', value: product.specs });
           }
        }
      } else if (typeof product.specs === 'object') {
        Object.entries(product.specs).forEach(([k, v]) => specs.push({ name: k, value: String(v) }));
      }
    }
    return specs;
  }, [product]);

  // Effect to initialize options when product data arrives (if not already set)
  useEffect(() => {
    if (product?.options?.length) {
      setSelectedOptions(prev => {
        const newOptions = { ...prev };
        let changed = false;

        product.options!.forEach((opt: any) => {
          if (!newOptions[opt.name]) {
            try {
              const values = typeof opt.values === 'string' ? JSON.parse(opt.values) : opt.values;
              if (Array.isArray(values) && values.length > 0) {
                const firstVal = values[0];
                newOptions[opt.name] = typeof firstVal === 'object' 
                  ? (firstVal.value || firstVal.name || String(firstVal)) 
                  : String(firstVal);
                changed = true;
              }
            } catch (e) {
              // Ignore
            }
          }
        });

        return changed ? newOptions : prev;
      });
    }

  }, [product]);

  useEffect(() => {
    // Force "sea" shipping if product is restricted and user hasn't explicitly chosen yet
    if (product?.isAirRestricted && !userChangedShipping.current && shippingMethod !== 'sea') {
      setShippingMethod('sea');
    }
  }, [product?.isAirRestricted, shippingMethod]);

  const pricingParams = useMemo(() => {
    if (!product) return null;
    
    const variants = product.variants || [];
    const minVariant = !currentVariant && variants.length > 0 
      ? variants.reduce((min: any, curr: any) => {
          if (!curr.price) return min;
          if (!min) return curr;
          return curr.price < min.price ? curr : min;
        }, null)
      : null;

    const target = currentVariant || minVariant || product;
    
    const basePrice = target.price || 0;
    
    const basePriceIQD = (target.basePriceIQD && target.basePriceIQD > 0) 
      ? target.basePriceIQD 
      : (product.basePriceIQD ?? null);

    return {
      basePrice,
      basePriceIQD
    };
  }, [product, currentVariant]);

  const { inclusivePrice, airPrice, seaPrice } = useMemo(() => {
    if (!product || !pricingParams) return { inclusivePrice: 0, airPrice: 0, seaPrice: 0 };
    
    const { basePrice, basePriceIQD } = pricingParams;

    const air = calculateInclusivePrice(
      basePrice,
      product.domesticShippingFee || 0,
      basePriceIQD
    );

    const sea = calculateInclusivePrice(
      basePrice,
      product.domesticShippingFee || 0,
      basePriceIQD
    );

    return { inclusivePrice: sea, airPrice: air, seaPrice: sea };
  }, [product, pricingParams]);



  const galleryImages = useMemo(() => {
    if (!product) return [];
    const images: any[] = [];
    
    // Add variant image first if selected
    if (currentVariant?.image) {
      images.push({ url: currentVariant.image, order: -10 });
    }

    if (product.image) images.push({ url: product.image, order: -1 });
    if (Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        if (img.type === 'GALLERY' || !img.type) {
          const url = typeof img === 'string' ? img : (img.url || img.image);
          if (url) images.push({ url, order: img.order || 0 });
        }
      });
    }
    const uniqueImages = images.reduce((acc: any[], current) => {
      if (!acc.find(item => item.url === current.url) && current.url) acc.push(current);
      return acc;
    }, []);
    return uniqueImages.sort((a, b) => a.order - b.order);
  }, [product, currentVariant?.image]);

  const detailImages = useMemo(() => {
    if (!product || !Array.isArray(product.images)) return [];
    return product.images
      .filter((img: any) => img.type === 'DETAIL' || img.type === 'DESCRIPTION') // Include DESCRIPTION type
      .map((img: any) => ({
        url: typeof img === 'string' ? img : (img.url || img.image),
        order: img.order || 0
      }))
      .sort((a: any, b: any) => a.order - b.order);
  }, [product]);

  useEffect(() => {
    const loadData = async () => {
      if (!productId) return;
      
      // Try to load initial data for immediate rendering
      const initialData = (location.state as any)?.initialProduct || findProductInGlobalCache(productId);
      
      if (initialData) {
        setProduct(initialData);
        setLoading(false);
        // Force rendering of details immediately if we have them
        if (initialData.images?.some((img: any) => img.type === 'DETAIL' || img.type === 'DESCRIPTION')) {
             setShouldRenderDetails(true);
        }
        
        // Initialize options for the new product immediately
        if (initialData.options?.length) {
          const options: Record<string, string> = {};
          initialData.options.forEach((opt: any) => {
            try {
              const values = typeof opt.values === 'string' ? JSON.parse(opt.values) : opt.values;
              if (Array.isArray(values) && values.length > 0) {
                const firstVal = values[0];
                options[opt.name] = typeof firstVal === 'object' 
                  ? (firstVal.value || firstVal.name || String(firstVal)) 
                  : String(firstVal);
              }
            } catch (e) {}
          });
          setSelectedOptions(options);
        } else {
          setSelectedOptions({});
        }
      } else {
        // Only if no initial data, try local storage cache
        const cacheKey = `/products/${productId}`;
        // Use v4 prefix to match api.ts
        const cachedProduct = localStorage.getItem(`app_cache_v4_${cacheKey}`);
        
        if (cachedProduct) {
          try {
            const { data } = JSON.parse(cachedProduct);
            setProduct(data);
            setLoading(false);
            
            // Initialize options from cache
            if (data.options?.length) {
              const options: Record<string, string> = {};
              data.options.forEach((opt: any) => {
                try {
                  const values = typeof opt.values === 'string' ? JSON.parse(opt.values) : opt.values;
                  if (Array.isArray(values) && values.length > 0) {
                    const firstVal = values[0];
                    options[opt.name] = typeof firstVal === 'object' 
                      ? (firstVal.value || firstVal.name || String(firstVal)) 
                      : String(firstVal);
                  }
                } catch (e) {}
              });
              setSelectedOptions(options);
            }
          } catch (e) {
            console.warn('Failed to parse cached product', e);
            setProduct(null);
            setLoading(true);
            setSelectedOptions({});
          }
        } else {
          setProduct(null);
          setLoading(true);
          setSelectedOptions({});
        }
      }

      setReviews([]);
      setShouldRenderDetails(false);

      // 1. Fetch main product info first (high priority)
      const fetchMainProduct = async () => {
        try {
          console.log('[ProductDetails] Fetching product from server:', productId);
          const productData = await fetchProductById(productId);
          console.log('[ProductDetails] Product fetched successfully:', productData);
          
          // Merge with initial data if present to avoid losing already-rendered info
          setProduct(prev => {
            if (!prev) return productData;
            // Check if we have description images
            if (productData.images?.some((img: any) => img.type === 'DETAIL' || img.type === 'DESCRIPTION')) {
                 setShouldRenderDetails(true);
            }
            return { ...prev, ...productData };
          });
          
          setError(null);
        } catch (err) {
          console.error('Error fetching product info:', err);
          // Use a functional state update to check if we have any product data
          setProduct(current => {
            if (!current) setError('حدث خطأ أثناء تحميل بيانات المنتج.');
            return current;
          });
        } finally {
          setLoading(false);
        }
      };

      // 2. Fetch reviews in background (medium priority)
      const fetchReviews = async () => {
        setReviewsLoading(true);
        try {
          const reviewsData = await fetchProductReviews(productId);
          setReviews(reviewsData);
        } catch (err) {
          console.error('Error fetching reviews:', err);
        } finally {
          setReviewsLoading(false);
        }
      };

      // 3. Check purchase status in background (low priority)
      const fetchPurchaseStatus = async () => {
        try {
          await checkProductPurchase(productId);
        } catch (err) {
          console.error('Error checking purchase status:', err);
        }
      };

      // Run fetches progressively
      fetchMainProduct();
      fetchReviews();
      fetchPurchaseStatus();
    };
    
    loadData();
  }, [productId, location.state, isAuthenticated, showToast]);

  const normalizeOptionValue = (val: any) => {
    const str = typeof val === 'object' && val !== null
      ? (val.value ?? val.name ?? JSON.stringify(val))
      : String(val);
    return fixMojibake(str).toLowerCase().trim();
  };

  const normalizeOptionKey = (key: string) => fixMojibake(String(key)).toLowerCase().trim();

  const normalizeOptionValues = (val: any): string[] => {
    if (Array.isArray(val)) {
      return val.flatMap(item => normalizeOptionValues(item));
    }
    return [normalizeOptionValue(val)];
  };

  const resolveVariantFromSelection = (options: Record<string, string>, variants: any[]) => {
    return variants.find((v: any) => {
      try {
        const combination = typeof v.combination === 'string' ? JSON.parse(v.combination) : v.combination;
        if (!combination) return false;

        return Object.entries(options).every(([selKey, selVal]) => {
          const selKeyNorm = normalizeOptionKey(selKey);
          let matchKey = Object.keys(combination).find(k => normalizeOptionKey(k) === selKeyNorm);

          if (!matchKey) {
            if (['color', 'colour', 'اللون'].includes(selKeyNorm)) {
              matchKey = Object.keys(combination).find(k => {
                const kNorm = normalizeOptionKey(k);
                return ['color', 'colour', 'اللون'].includes(kNorm);
              });
            } else if (['size', 'المقاس'].includes(selKeyNorm)) {
              matchKey = Object.keys(combination).find(k => {
                const kNorm = normalizeOptionKey(k);
                return ['size', 'المقاس'].includes(kNorm);
              });
            }
          }

          if (!matchKey) return false;

          const comboVals = normalizeOptionValues(combination[matchKey]);
          const selectedVals = normalizeOptionValues(selVal);
          return selectedVals.some(v => comboVals.includes(v));
        });
      } catch (_e) {
        return false;
      }
    });
  };

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const variant = resolveVariantFromSelection(selectedOptions, product.variants);
      setCurrentVariant(variant || null);
    }
  }, [selectedOptions, product]);



  useEffect(() => {
    if (productId && product) {
      // Track VIEW event
      // We use a small timeout to ensure it's a real view, not just a quick bounce
      const timer = setTimeout(() => {
        trackInteraction(productId, 'VIEW', 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [productId, product?.id]);

  const handleShippingMethodChange = (method: 'air' | 'sea') => {
    if (product?.isAirRestricted && method === 'air') return;
    setShippingMethod(method);
    userChangedShipping.current = true;
    if (productId) {
      localStorage.setItem(`shipping_pref_${productId}`, method);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    if (!shippingMethod) {
      showToast('يرجى اختيار طريقة الشحن', 'error');
      return;
    }
    const finalShippingMethod = shippingMethod;
    
    if (!isAuthenticated) {
      showToast('يرجى تسجيل الدخول أولاً لإضافة منتجات إلى السلة', 'info');
      navigate('/login');
      return;
    }
    
    let resolvedVariant = currentVariant;
    
    // 1. Try strict resolution
    if (!resolvedVariant && product.variants?.length) {
       try {
         resolvedVariant = resolveVariantFromSelection(selectedOptions, product.variants);
       } catch (e) {
         console.error('Error resolving variant:', e);
       }
    }

    // 2. Fallback: Loose resolution (ignore extra keys in selectedOptions)
    if (!resolvedVariant && product.variants?.length) {
      resolvedVariant = product.variants.find((v: any) => {
        try {
          const combination = typeof v.combination === 'string' ? JSON.parse(v.combination) : v.combination;
          if (!combination) return false;
          
          // Check if ALL keys in combination match the selected options
          // (Ignoring keys in selectedOptions that are NOT in combination)
          return Object.entries(combination).every(([key, val]) => {
            const normKey = normalizeOptionKey(key);
            // Find corresponding selected option
            const selectedKey = Object.keys(selectedOptions).find(k => normalizeOptionKey(k) === normKey);
            if (!selectedKey) return false; // Variant requires this option, but user didn't select it
            
            const selectedVal = selectedOptions[selectedKey];
            const comboVals = normalizeOptionValues(val);
            const selectedVals = normalizeOptionValues(selectedVal);
            return selectedVals.some(v => comboVals.includes(v));
          });
        } catch (e) { return false; }
      });
    }

    // 3. Last Resort: Default to first variant if options are selected but no match found
    // This handles cases where data is inconsistent but we want to allow the sale
    if (!resolvedVariant && product.variants?.length && Object.keys(selectedOptions).length > 0) {
       resolvedVariant = product.variants[0];
    }

    if (product.variants?.length && !resolvedVariant) {
      showToast('يرجى اختيار جميع الخيارات المطلوبة', 'error');
      return;
    }

    // Optimistic state update in the UI
    setIsAdding(true);
    setIsAdded(true);
    showToast('تمت إضافة المنتج إلى السلة بنجاح', 'success');

    try {
      await addItem(product.id, 1, resolvedVariant?.id, {
        id: product.id,
        name: product.name,
        price: resolvedVariant?.price || product.price || 0,
        image: resolvedVariant?.image || product.image,
        variant: resolvedVariant,
        domesticShippingFee: product.domesticShippingFee,
        basePriceIQD: product.basePriceIQD,
        deliveryTime: product.deliveryTime
      }, selectedOptions, finalShippingMethod);

      trackInteraction(product.id, 'CART', 5);
      setIsActionSheetOpen(false);
    } catch (err) {
      console.error('Error in addItem:', err);
      setIsAdded(false);
      showToast(`فشل إضافة المنتج: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const openActionSheet = () => {
    setIsActionSheetOpen(true);
  };

  const handleShare = async () => {
    if (!product) return;
    const shareData = { title: product.name, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await Clipboard.write({ string: window.location.href });
        showToast('تم نسخ الرابط إلى الحافظة', 'info');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  if (loading && !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark pt-safe">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
            </div>
            <p className="text-sm font-bold text-slate-500 animate-pulse">جاري تحضير طلبك...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark items-center justify-center p-6 text-center rtl pt-safe" dir="rtl">
        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 text-slate-400">
          {error ? <AlertCircle size={48} /> : <Package size={48} />}
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{error ? 'خطأ في التحميل' : 'المنتج غير موجود'}</h2>
        <p className="mt-2 text-slate-500">{error || 'عذراً، لم نتمكن من العثور على المنتج الذي تبحث عنه.'}</p>
        <div className="flex gap-4 mt-6">
          <button onClick={() => navigate('/')} className="px-6 py-2 border border-primary text-primary rounded-lg font-bold">العودة للرئيسية</button>
          {error && <button onClick={() => window.location.reload()} className="px-6 py-2 bg-primary text-white rounded-lg font-bold">إعادة المحاولة</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark pb-32 pb-safe pt-safe" dir="rtl">
      <ProductHeader 
        onBack={() => navigate(-1)}
        onShare={handleShare}
        onToggleWishlist={() => toggleWishlist(product.id, product)}
        isWishlisted={isProductInWishlist(product.id)}
      />

      <div className="md:grid md:grid-cols-2 md:gap-8 lg:gap-12 md:px-6 md:pt-6">
        <div className="md:sticky md:top-24 h-fit">
          <ImageGallery 
            images={galleryImages}
            productName={product.name}
            hideIndicators={isActionSheetOpen}
          />
        </div>

        <main className="relative -mt-10 md:mt-0 bg-background-light dark:bg-background-dark rounded-t-[2.5rem] md:rounded-none px-5 md:px-0 pt-8 md:pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-none z-10 min-h-[50vh]">
          <ProductInfo 
            price={pricingParams?.basePrice || 0}
            originalPrice={product.originalPrice}
            name={product.name}
            deliveryTime={product.deliveryTime}
            averageRating={averageRating}
            totalReviews={allReviews.length}
            domesticShippingFee={product.domesticShippingFee}
            basePriceIQD={pricingParams?.basePriceIQD}
            calculatedAirPrice={airPrice}
            calculatedSeaPrice={seaPrice}
            shippingMethod={shippingMethod}
            onShippingMethodChange={handleShippingMethodChange}
            isAirRestricted={product.isAirRestricted}
          />

          <ProductDescription 
            productName={product.name}
            description={product.description}
          />

          <ReviewsSection 
                reviews={allReviews} 
                reviewSummary={reviewSummary}
                loading={reviewsLoading}
              />

          <ProductSpecs specs={displaySpecs} />

          {detailImages.length > 0 && shouldRenderDetails && (
            <div className="mt-12 space-y-4 px-0">
              <div className="flex items-center gap-3 mb-6 px-5">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="text-slate-900 dark:text-white text-lg font-black">تفاصيل إضافية</h3>
              </div>
              <div className="flex flex-col">
                {detailImages.map((img: any, idx: number) => (
                  <LazyImage 
                    key={idx}
                    src={img.url} 
                    alt={`Detail ${idx + 1}`}
                    width={800}
                    quality={75}
                    className="w-full h-auto"
                  />
                ))}
              </div>
            </div>
          )}

          <SimilarProducts 
            products={similarProducts}
            onProductClick={(id) => {
              const selectedProduct = similarProducts.find(p => p.id === id);
              navigate(`/product?id=${id}`, { state: { initialProduct: selectedProduct } });
            }}
          />

          {/* Spacer for mobile bottom bar */}
          <div className="h-24 md:h-12"></div>
        </main>

        <AddToCartBar 
            price={inclusivePrice}
            onAddToCart={openActionSheet}
            isAdding={isAdding}
            isAdded={isAdded}
            onGoToCart={() => navigate('/cart')}
          />
          
          {/* Action Sheet for Options & Shipping - Moved outside main for better stacking context */}
          <ProductActionSheet
            isOpen={isActionSheetOpen}
            onClose={() => setIsActionSheetOpen(false)}
            product={product}
            selectedOptions={selectedOptions}
            onOptionSelect={(name, val) => setSelectedOptions(prev => ({ ...prev, [name]: val }))}
            onVariantSelect={(combination) => setSelectedOptions(combination)}
            currentVariant={currentVariant}
            shippingMethod={shippingMethod}
            onShippingChange={handleShippingMethodChange}
            onConfirm={handleAddToCart}
            isAdding={isAdding}
            price={inclusivePrice}
          />
      </div>
    </div>
  );
};

export default ProductDetails;
