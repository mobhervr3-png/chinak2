import { create } from 'zustand';

interface MaintenanceState {
  isServerDown: boolean;
  lastError: string | null;
  lastUrl: string | null;
  setServerDown: (isDown: boolean, error?: string | null, url?: string | null) => void;
  clearError: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isServerDown: false,
  lastError: null,
  lastUrl: null,
  setServerDown: (isDown, error = null, url = null) => set({ 
    isServerDown: isDown, 
    lastError: error,
    lastUrl: url
  }),
  clearError: () => set({ lastError: null, lastUrl: null }),
}));
