import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchCart, updateCartItem, removeFromCart, addToCart, fetchSettings } from '../services/api';
import type { ShippingRates } from '../types/shipping';
import type { Product } from '../types/product';

interface CartItem {
  id: number | string;
  productId: number | string;
  variantId?: number | string;
  selectedOptions?: string | any;
  quantity: number;
  shippingMethod: 'air' | 'sea';
  price?: number; // Inclusive price from server
  product: Product;
  variant?: {
    id: number | string;
    combination: string;
    price: number;
    basePriceIQD?: number | null;
    image?: string;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    basePriceRMB?: number;
    isPriceCombined?: boolean;
  };
  lastUpdated?: number;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  isSyncing: boolean;
  syncRequestCount: number;
  error: string | null;
  deletingIds: (number | string)[];
  rates: ShippingRates;
  lastSynced: number | null;
  fetchCart: (silent?: boolean) => Promise<void>;
  fetchRates: () => Promise<void>;
  addItem: (
    productId: number | string, 
    quantity?: number, 
    variantId?: number | string, 
    productInfo?: { 
      id: number | string; 
      name: string; 
      price: number; 
      image: string; 
      variant?: any; 
      weight?: number; 
      length?: number; 
      width?: number; 
      height?: number; 
      domesticShippingFee?: number;
      basePriceIQD?: number;
      minOrder?: number;
      deliveryTime?: string;
      basePriceRMB?: number;
      isPriceCombined?: boolean;
    }, 
    selectedOptions?: any,
    shippingMethod?: 'air' | 'sea'
  ) => Promise<void>;
  updateQuantity: (itemId: number | string, quantity: number) => Promise<void>;
  removeItem: (itemId: number | string) => Promise<void>;
  removeItems: (itemIds: (number | string)[]) => Promise<void>;
  clearCart: () => void;
  clearShippingMethodItems: (method: 'air' | 'sea') => void;
  getTotalItems: (method?: 'air' | 'sea') => number;
  getBaseSubtotal: (method?: 'air' | 'sea') => number;
  getShippingTotal: (method?: 'air' | 'sea') => number;
  getSubtotal: (method?: 'air' | 'sea') => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isSyncing: false,
      syncRequestCount: 0,
      error: null,
      deletingIds: [],
      lastSynced: null,
      rates: {
        airRate: 15400,
        seaRate: 182000,
        chinaDomesticRate: 1500,
        minFloor: 0
      },

      fetchRates: async () => {
        try {
          const settings = await fetchSettings();
          if (settings) {
            set({
              rates: {
                airRate: settings.airShippingRate || 15400,
                seaRate: settings.seaShippingRate || 182000,
                chinaDomesticRate: settings.chinaDomesticShipping || 1500,
                minFloor: 0
              }
            });
          }
        } catch (e) {
          console.error('Failed to fetch rates in store:', e);
        }
      },

      fetchCart: async (silent = false) => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return; // Stay local if not logged in
        }

        // Only sync if we haven't synced in the last 5 minutes or if explicitly requested
        const { lastSynced, items: localItems } = get();
        if (silent && lastSynced && Date.now() - lastSynced < 300000) {
          return;
        }

        if (!silent || localItems.length === 0) {
          set({ isLoading: true });
        }

        try {
          const serverData = await fetchCart();
          const serverItems = Array.isArray(serverData) ? serverData : [];
          
          set((state) => {
            const currentLocalItems = state.items;
            
            // Map server items, but prefer local optimistic state if it was updated recently (< 5s)
            // This prevents race conditions where the server hasn't processed the latest update yet
            const mergedItems = serverItems.map(serverItem => {
              const localMatch = currentLocalItems.find(localItem => 
                String(localItem.id) === String(serverItem.id) || 
                (
                  String(localItem.productId) === String(serverItem.productId) &&
                  localItem.variantId === serverItem.variantId &&
                  localItem.selectedOptions === serverItem.selectedOptions &&
                  localItem.shippingMethod === serverItem.shippingMethod
                )
              );

              if (localMatch && localMatch.lastUpdated && (Date.now() - localMatch.lastUpdated < 5000)) {
                return { ...serverItem, ...localMatch, id: serverItem.id }; // Keep server ID but local data
              }
              
              return serverItem;
            });

            // Add purely local items (id starts with local-) that aren't in server items yet
            const localOnly = currentLocalItems.filter(item => 
              typeof item.id === 'string' && item.id.startsWith('local-') &&
              !mergedItems.some(m => 
                String(m.productId) === String(item.productId) &&
                m.variantId === item.variantId &&
                m.selectedOptions === item.selectedOptions &&
                m.shippingMethod === item.shippingMethod
              )
            );

            return { 
              items: [...mergedItems, ...localOnly], 
              lastSynced: Date.now(), 
              isLoading: false 
            };
          });
        } catch (err) {
          console.error('Failed to sync cart:', err);
          set({ isLoading: false });
        }
      },

      addItem: async (productId, quantity = 1, variantId, productInfo, selectedOptions, shippingMethod = 'air') => {
        const { items } = get();
        const sOptions = typeof selectedOptions === 'object' && selectedOptions !== null 
          ? JSON.stringify(selectedOptions) 
          : (selectedOptions || null);
        
        const existingItem = items.find(item => {
          const sameProduct = String(item.productId) === String(productId);
          const sameVariant = (item.variantId === variantId) || 
                            (item.variantId === null && variantId === undefined) ||
                            (item.variantId === undefined && variantId === null) ||
                            (item.variantId && variantId && String(item.variantId) === String(variantId));
          const sameOptions = (item.selectedOptions === sOptions) || 
                            (!item.selectedOptions && !sOptions);
          const sameShipping = item.shippingMethod === shippingMethod;
          return sameProduct && sameVariant && sameOptions && sameShipping;
        });

        if (existingItem) {
          set({
            items: items.map(item => 
              item.id === existingItem.id 
                ? { ...item, quantity: item.quantity + quantity, lastUpdated: Date.now() }
                : item
            )
          });
          
          // Background sync
          try {
            if (typeof existingItem.id === 'string' && existingItem.id.startsWith('local-')) {
              // If it's still local, use addToCart to sync (server handles upsert)
              addToCart(productId, quantity, variantId, selectedOptions, shippingMethod).then(response => {
                if (response && response.id) {
                  set({
                    items: get().items.map(item => item.id === existingItem.id ? response : item)
                  });
                }
              }).catch(() => {});
            } else {
              updateCartItem(existingItem.id, existingItem.quantity + quantity).catch(() => {});
            }
          } catch (_e) {}
        } else if (productInfo) {
          const tempId = `local-${Date.now()}`;
          const newItem: CartItem = {
            id: tempId,
            productId,
            variantId,
            selectedOptions: sOptions,
            quantity,
            shippingMethod,
            product: {
              id: productInfo.id,
              name: productInfo.name,
              price: productInfo.price,
              image: productInfo.image,
              weight: productInfo.weight,
              length: productInfo.length,
              width: productInfo.width,
              height: productInfo.height,
              domesticShippingFee: productInfo.domesticShippingFee,
              basePriceRMB: productInfo.basePriceRMB,
              isPriceCombined: productInfo.isPriceCombined
            },
            variant: productInfo.variant,
            lastUpdated: Date.now()
          };
          set({ items: [...items, newItem] });
          
          // Background sync
          try {
            addToCart(productId, quantity, variantId, selectedOptions, shippingMethod).then(response => {
              if (response && response.id) {
                // Update the local item with the server ID to keep them in sync
                set({
                  items: get().items.map(item => item.id === tempId ? response : item)
                });
              }
            }).catch(() => {});
          } catch (_e) {}
        }
      },

      updateQuantity: async (itemId, quantity) => {
         if (quantity < 1) return;
         const { items } = get();
         
         set({
           items: items.map(item => 
             item.id === itemId ? { ...item, quantity, lastUpdated: Date.now() } : item
           )
         });
 
         // Background sync
         if (typeof itemId === 'string' && itemId.startsWith('local-')) return;
 
         try {
           set((state) => ({ 
             isSyncing: true, 
             syncRequestCount: (state.syncRequestCount || 0) + 1 
           }));
           await updateCartItem(itemId, quantity);
         } catch (_e) {
           // Silent fail for now, optimistic update persists
         } finally {
           set((state) => {
             const newCount = Math.max(0, (state.syncRequestCount || 0) - 1);
             return { 
               syncRequestCount: newCount,
               isSyncing: newCount > 0
             };
           });
         }
       },
 
       removeItem: async (itemId) => {
         const { items } = get();
         set({
           items: items.filter(item => item.id !== itemId)
         });
 
         // Background sync
         if (typeof itemId === 'string' && itemId.startsWith('local-')) return;
 
         try {
           removeFromCart(itemId).catch(() => {});
         } catch (_e) {}
       },
 
       removeItems: async (itemIds) => {
         const { items } = get();
         set({
           items: items.filter(item => !itemIds.includes(item.id))
         });
 
         // Background sync
         try {
           const serverIds = itemIds.filter(id => !(typeof id === 'string' && id.startsWith('local-')));
           if (serverIds.length > 0) {
             Promise.all(serverIds.map(id => removeFromCart(id))).catch(() => {});
           }
         } catch (_e) {}
       },

      clearCart: () => {
        set({ items: [] });
      },

      clearShippingMethodItems: (method) => {
        const { items } = get();
        set({ items: items.filter(i => i.shippingMethod !== method) });
      },

      getTotalItems: (method) => {
        const items = method ? get().items.filter(i => i.shippingMethod === method) : get().items;
        return items.reduce((acc, item) => acc + item.quantity, 0);
      },

      getBaseSubtotal: (method) => {
        const { items: allItems, rates } = get();
        const items = method ? allItems.filter(i => i.shippingMethod === method) : allItems;
        return items.reduce((acc, item) => {
          const basePrice = item.variant?.price || item.product.price || 0;
          
          // Agent Logic: Add Service Fee (e.g. 5%) or fixed fee if needed?
          // For now, just raw price.
          
          return acc + (basePrice * item.quantity);
        }, 0);
      },

      getShippingTotal: (method) => {
        // Agent Logic: Calculate estimated international shipping
        const { items: allItems, rates } = get();
        const items = method ? allItems.filter(i => i.shippingMethod === method) : allItems;
        
        return items.reduce((total, item) => {
          // If it's an Agent product (has provider), we charge shipping separately
          if (item.product.provider) {
             const weight = item.variant?.weight || item.product.weight || 0.5; // Default 0.5kg
             const rate = item.shippingMethod === 'air' ? rates.airRate : rates.seaRate;
             return total + (weight * rate * item.quantity);
          }
          return total; // Standard products have free shipping (included in price)
        }, 0);
      },

      getSubtotal: (method) => {
        const baseSubtotal = get().getBaseSubtotal(method);
        const shippingTotal = get().getShippingTotal(method);
        return baseSubtotal + shippingTotal;
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
