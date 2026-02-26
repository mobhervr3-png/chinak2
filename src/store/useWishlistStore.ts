import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../types/product';

interface WishlistItem {
  id: number | string;
  productId: number | string;
  product: Product;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  error: string | null;
  fetchWishlist: (silent?: boolean) => Promise<void>;
  toggleWishlist: (productId: number | string, productInfo?: any) => Promise<void>;
  isProductInWishlist: (productId: number | string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      fetchWishlist: async () => {
        // No-op for local favorites
      },

      toggleWishlist: async (productId: number | string, productInfo?: any) => {
        const { items } = get();
        const isInWishlist = items.some(item => String(item.productId) === String(productId));

        if (isInWishlist) {
          set({ items: items.filter(item => String(item.productId) !== String(productId)) });
        } else if (productInfo) {
          const newItem: WishlistItem = {
            id: `local-${Date.now()}`,
            productId,
            product: {
              id: productInfo.id,
              name: productInfo.name,
              price: productInfo.price,
              image: productInfo.image,
              description: productInfo.description || '',
              weight: productInfo.weight,
              length: productInfo.length,
              width: productInfo.width,
              height: productInfo.height
            }
          };
          set({ items: [...items, newItem] });
        }
      },

      isProductInWishlist: (productId: number | string) => {
        return get().items.some(item => String(item.productId) === String(productId));
      },

      clearWishlist: () => {
        set({ items: [], error: null, isLoading: false });
      },
    }),
    {
      name: 'user-wishlist',
    }
  )
);
