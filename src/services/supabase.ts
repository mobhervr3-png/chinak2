import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://puxjtecjxfjldwxiwzrk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eGp0ZWNqeGZqbGR3eGl3enJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NDEyNjMsImV4cCI6MjA4MzUxNzI2M30.r9TxaSGhOEWeb3RP_BEsHGQ1GOBpI0-mkU0XdW3FEOc'; 

// Custom Storage Adapter to handle QuotaExceededError
const customStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (_e) {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
        console.warn('Supabase Storage quota exceeded! Emergency clearing...');
        
        // 1. Clear ALL non-essential data
        const CACHE_PREFIX = 'app_cache_';
        Object.keys(localStorage).forEach(k => {
          // Keep only auth tokens and critical settings
          if (k.startsWith(CACHE_PREFIX) || k.includes('checkout') || k.includes('recent')) {
            localStorage.removeItem(k);
          }
        });

        // 2. Try again
        try {
          localStorage.setItem(key, value);
        } catch (_retryError) {
          // If still fails, clear everything EXCEPT the key we are trying to set
          console.error('Critical storage failure. Clearing almost everything.');
          Object.keys(localStorage).forEach(k => {
            if (k !== key && !k.includes('auth-token')) {
              localStorage.removeItem(k);
            }
          });
          try {
            localStorage.setItem(key, value);
          } catch (_lastError) {
            console.error('Failed to save essential auth token.');
          }
        }
      }
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (_e) {
      // ignore
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
