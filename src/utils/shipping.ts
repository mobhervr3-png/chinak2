import type { ShippingRates } from '../types/shipping';

export const calculateShippingFee = (
  _weight: number | undefined,
  _length: number | undefined,
  _width: number | undefined,
  _height: number | undefined,
  _rates: ShippingRates,
  _price: number = 0,
  _forcedMethod?: 'AIR' | 'SEA' | 'air' | 'sea',
  _domesticShippingFee: number = 0,
  _applyMinimum: boolean = true,
  _variant?: { weight?: number | null; length?: number | null; width?: number | null; height?: number | null }
) => {
  // International shipping fee is now free for all methods as per request
  return 0;
};

export const getDefaultShippingMethod = (weight?: number, _length?: number, _width?: number, _height?: number): 'air' | 'sea' => {
  // weight in database is already in kg
  const weightInKg = weight || 0.5;

  if (weightInKg > 0 && weightInKg < 1) {
    return 'air';
  }
  
  if (weightInKg >= 1) {
    return 'sea';
  }

  return 'air'; // Default to air for small/unknown items
};

export const calculateInclusivePrice = (
  basePrice: number, 
  _domesticShippingFee: number = 0,
  _basePriceIQD?: number | null,
  _rates?: any
) => {
  // Price is always combined now (stored as final in DB)
  return basePrice;
};
