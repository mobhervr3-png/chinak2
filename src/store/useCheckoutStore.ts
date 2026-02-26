import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShippingInfo } from '../types/shipping';

interface CheckoutState {
  selectedAddressId: number | string | null;
  shippingMethod: 'air' | 'sea';
  paymentMethod: 'zain_cash' | 'super_key' | 'cash';
  appliedCoupon: any | null;
  shippingFee: number;
  shippingInfo: ShippingInfo | null;
  setSelectedAddressId: (id: number | string) => void;
  setShippingMethod: (method: 'air' | 'sea') => void;
  setPaymentMethod: (method: 'zain_cash' | 'super_key' | 'cash') => void;
  setAppliedCoupon: (coupon: any | null) => void;
  setShippingFee: (fee: number) => void;
  setShippingInfo: (info: ShippingInfo | null) => void;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      selectedAddressId: null,
      shippingMethod: 'sea',
      paymentMethod: 'zain_cash',
      appliedCoupon: null,
      shippingFee: 0,
      shippingInfo: null,
      setSelectedAddressId: (id) => set({ selectedAddressId: id }),
      setShippingMethod: (method) => set({ shippingMethod: method }),
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      setShippingFee: (fee) => set({ shippingFee: fee }),
      setShippingInfo: (info) => set({ shippingInfo: info }),
      resetCheckout: () => set({ 
        selectedAddressId: null, 
        shippingMethod: 'sea', 
        paymentMethod: 'zain_cash',
        appliedCoupon: null,
        shippingFee: 0,
        shippingInfo: null
      }),
    }),
    {
      name: 'checkout-storage',
    }
  )
);
