import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  pushNotifications: boolean;
  orderUpdates: boolean;
  promotionalOffers: boolean;
  biometricLogin: boolean;
  currency: 'IQD' | 'USD';
  
  toggleSetting: (key: keyof Omit<SettingsState, 'toggleSetting' | 'setCurrency'>) => void;
  setCurrency: (curr: 'IQD' | 'USD') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotifications: true,
      orderUpdates: true,
      promotionalOffers: false,
      biometricLogin: true,
      currency: 'IQD',

      toggleSetting: (key) => set((state) => ({ [key]: !state[key] })),
      setCurrency: (curr) => set({ currency: curr }),
    }),
    {
      name: 'app-settings',
    }
  )
);
