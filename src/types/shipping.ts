export interface ShippingInfo {
  fee: number;
  isThresholdMet: boolean;
  threshold: number;
  subtotal: number;
  contribution: number;
  chinaDomesticFee?: number;
  internationalFee?: number;
  isAvailable?: boolean;
  itemsMissingWeight?: string[];
}

export interface ShippingRates {
  airRate: number;
  seaRate: number;
  minFloor: number;
  chinaDomesticRate?: number;
}

// Runtime value for the interface to avoid SyntaxError if imported as value
export const ShippingRates = {}; 

export const SHIPPING_TYPES = true;
