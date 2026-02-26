import { supabase } from './supabase';
import { useMaintenanceStore } from '../store/useMaintenanceStore';
import { localProductService } from './localProductService';

export const getBaseDomain = () => {
  const hostname = window.location.hostname;
  const isPrivateIp = (value: string) => /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(value);
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';

  // 0. Manual Override (Useful for testing production builds against local backends)
  const manualOverride = localStorage.getItem('api_url_override');
  if (manualOverride) return manualOverride;

  // 1. Priority: Environment variable
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) return envApiUrl;

  if (!import.meta.env.PROD && isLocalHost) {
    return '';
  }

  // 2. Production Check (Highest priority for released apps)
  if (import.meta.env.PROD) {
    // If we're in a PROD build, we should generally use the production backend
    // EXCEPT if we are on an emulator and want to test the prod build against a local backend
    const isCapacitor = window.hasOwnProperty('Capacitor');
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/i.test(userAgent);
    
    // Check if we are actually on the production domain or if it's a capacitor app that should connect to prod
    if (hostname.includes('shanshal66') || hostname.includes('hf.space') || (isCapacitor && !hostname.includes('10.0.2.2') && !hostname.includes('10.0.3.2'))) {
      return 'https://shanshal66-my-shop-backend.hf.space';
    }

    // If we are in PROD build but running on emulator (10.0.2.2), allow local connection
    if (isAndroid && (hostname === 'localhost' || hostname === '10.0.2.2' || hostname === '10.0.3.2')) {
      return 'http://10.0.2.2:5001';
    }
    
    return 'https://shanshal66-my-shop-backend.hf.space';
  }

  // 3. Mobile / Emulator Check (For development)
  const isCapacitor = window.hasOwnProperty('Capacitor');
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(userAgent);
  
  if (isCapacitor || isAndroid) {
    // If we're on an Android emulator
    if (isAndroid) {
      if (hostname && hostname !== 'localhost' && hostname !== '10.0.2.2' && hostname !== '10.0.3.2' && isPrivateIp(hostname)) {
        return `http://${hostname}:5001`;
      }
      return 'http://10.0.2.2:5001';
    }
    if (hostname && hostname !== 'localhost' && isPrivateIp(hostname)) {
      return `http://${hostname}:5001`;
    }
    return 'http://192.168.2.228:5001';
  }

  // 4. Default local development (Browser)
  if (isLocalHost) {
    return '';
  }

  return 'https://shanshal66-my-shop-backend.hf.space';
};

const API_BASE_URL = `${getBaseDomain()}/api`;
const MOCK_SETTINGS_KEY = 'mock_admin_settings';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

// Persistent Cache Implementation
const CACHE_PREFIX = 'app_cache_v4_'; // Changed prefix to invalidate old cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache for faster updates during dev

const persistentCache = {
  get: (key: string) => {
    try {
      // 1. Check in-memory first for speed
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }

      // 2. Check localStorage if not in memory
      const stored = localStorage.getItem(CACHE_PREFIX + key);
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < CACHE_TTL) {
          // Re-populate in-memory cache
          cache.set(key, { data, timestamp });
          return data;
        } else {
          localStorage.removeItem(CACHE_PREFIX + key);
        }
      }
    } catch (_e) {
      console.warn('Cache retrieval error:', _e);
    }
    return null;
  },
  set: (key: string, data: any) => {
    try {
      const timestamp = Date.now();
      // Update memory
      cache.set(key, { data, timestamp });
      
      // Update localStorage (only for safe GET requests)
      // Limit: don't store objects larger than ~500KB in localStorage (increased from 100KB)
      const serialized = JSON.stringify({ data, timestamp });
      if (serialized.length > 500000) {
        return;
      }

      // Proactive Cleanup: if we have more than 30 cached items, remove the oldest one
      const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 30) {
        // Remove the first few keys to make space
        cacheKeys.slice(0, 5).forEach(k => localStorage.removeItem(k));
      }

      localStorage.setItem(CACHE_PREFIX + key, serialized);
    } catch (e: any) {
      // If quota exceeded, clear all non-essential data
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
        console.warn('LocalStorage quota exceeded! Performing emergency cleanup...');
        
        // 1. Clear ALL app_cache_ keys
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(k);
          }
        });

        // 2. Try again (only if it's essential or small)
        try {
          const timestamp = Date.now();
          const serialized = JSON.stringify({ data, timestamp });
          localStorage.setItem(CACHE_PREFIX + key, serialized);
        } catch (_retryError) {
          console.error('Final attempt to cache failed.');
        }
      } else {
        console.warn('Cache storage error:', e);
      }
    }
  },
  delete: (key: string) => {
    cache.delete(key);
    localStorage.removeItem(CACHE_PREFIX + key);
  },
  clear: () => {
    cache.clear();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },
  // Add this new method for startup maintenance
  maintenance: () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      
      // Aggressive cleanup: if we have any cache keys and it's startup, clear them if they are more than 15
      // This ensures we always have space for login tokens
      if (cacheKeys.length > 15) {
        cacheKeys.forEach(k => localStorage.removeItem(k));
        console.log('Startup Maintenance: Cleared cache to ensure space for auth.');
        return;
      }

      // 1. Clear expired items
      cacheKeys.forEach(key => {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Date.now() - (parsed.timestamp || 0) > CACHE_TTL) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          localStorage.removeItem(key); // Remove corrupted entries
        }
      });
    } catch (e) {
      console.error('Cache maintenance error:', e);
    }
  },
  invalidatePattern: (pattern: string) => {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
        localStorage.removeItem(CACHE_PREFIX + key);
      }
    }
    // Also check localStorage keys directly
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  },
  // New helper to find a single product in any cached list
  findProductInLists: (productId: string | number) => {
    try {
      // Search in-memory cache first
      for (const [key, value] of cache.entries()) {
        if (key.includes('/products') && Array.isArray(value.data)) {
          const found = value.data.find((p: any) => String(p.id) === String(productId));
          if (found) return found;
        }
        // Also check if the data is an object with a products array
        if (key.includes('/products') && value.data?.products && Array.isArray(value.data.products)) {
          const found = value.data.products.find((p: any) => String(p.id) === String(productId));
          if (found) return found;
        }
      }

      // Search localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX) && key.includes('/products')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const { data } = JSON.parse(stored);
            const products = Array.isArray(data) ? data : (data?.products || []);
            const found = products.find((p: any) => String(p.id) === String(productId));
            if (found) return found;
          }
        }
      }
    } catch (e) {
      console.warn('Error searching global cache:', e);
    }
    return null;
  }
};

export const findProductInGlobalCache = persistentCache.findProductInLists;
export const performCacheMaintenance = persistentCache.maintenance;

// Run maintenance immediately on load to prevent QuotaExceededError
performCacheMaintenance();

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')?.trim();
  if (!token || token === 'null' || token === 'undefined') return {};
  return { 'Authorization': `Bearer ${token}` };
}

// Base fetch wrapper with caching and retry logic
export async function request(endpoint: string, options: any = {}, retries = 2) {
  const isGet = !options.method || options.method === 'GET';
  const isAuthMe = endpoint.includes('/auth/me');
  const skipCache = options.skipCache || isAuthMe || false;
  const cacheKey = endpoint;
  const skipMaintenanceTrigger = options.skipMaintenanceTrigger || false;

  // Check cache for GET requests
  if (isGet && !skipCache) {
    const cachedData = persistentCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  let currentBaseUrl = API_BASE_URL;

  const executeRequest = async (attempt: number, authRetry = 0): Promise<any> => {
    const storedToken = localStorage.getItem('auth_token')?.trim();
    const providedToken = typeof options.token === 'string' ? options.token.trim() : null;

    let token = providedToken || storedToken;
    if (providedToken?.startsWith('test-token-')) token = providedToken;
    
    // Explicitly handle "null" or "undefined" strings that can sometimes get into localStorage
    if (token === 'null' || token === 'undefined') {
      token = null;
    }

    // Handle test tokens for Google Play reviewers
    if (token?.startsWith('test-token-')) {
      const isReviewer2 = token.includes('1987654321');
      const isAdmin = false; // Disable admin access for test tokens as requested
      
      const userData = {
        id: 'reviewer-id-' + (isReviewer2 ? '2' : '1'),
        phone: isReviewer2 ? '+1987654321' : '+1234567890',
        name: isReviewer2 ? 'Reviewer 2' : 'Google Play Reviewer',
        email: isReviewer2 ? 'reviewer2@example.com' : 'reviewer@example.com',
        role: 'USER'
      };

      if (endpoint.includes('/auth/me')) {
        return userData;
      }
      
      if (endpoint.includes('/auth/sync-supabase-user')) {
        return { 
          success: true,
          user: userData
        };
      }

      // Handle admin endpoints for test admin account
      if (isAdmin && endpoint.startsWith('/admin')) {
        if (endpoint.includes('/settings')) {
          if (options.method === 'PUT' && options.body) {
            localStorage.setItem(MOCK_SETTINGS_KEY, options.body);
            return JSON.parse(options.body);
          }
          const savedSettings = localStorage.getItem(MOCK_SETTINGS_KEY);
          if (savedSettings) return JSON.parse(savedSettings);

          return {
            airShippingRate: 15400,
            seaShippingRate: 182000,
            airShippingMinFloor: 0,
            currency: 'د.ع',
            storeName: 'My Shop (Review Mode)',
            contactEmail: 'admin@example.com',
            contactPhone: '+1987654321',
            footerText: 'Google Play Review Version',
            socialLinks: {}
          };
        }
        if (endpoint.includes('/stats')) {
          return {
            stats: {
              totalOrders: 15,
              totalRevenue: 2500000,
              totalUsers: 42,
              totalProducts: 120,
              recentActivity: [],
              orderStats: {
                pending: 5,
                processing: 3,
                shipped: 4,
                delivered: 3
              },
              revenueStats: [
                { date: '2026-01-20', amount: 150000 },
                { date: '2026-01-21', amount: 200000 },
                { date: '2026-01-22', amount: 180000 },
                { date: '2026-01-23', amount: 300000 },
                { date: '2026-01-24', amount: 250000 },
                { date: '2026-01-25', amount: 400000 }
              ]
            }
          };
        }
        if (endpoint.includes('/users')) return { users: [], totalPages: 1, total: 0 };
        if (endpoint.includes('/products')) return { products: [], totalPages: 1, total: 0 };
        if (endpoint.includes('/orders')) return { orders: [], totalPages: 1, total: 0 };
        if (endpoint.includes('/coupons')) return [];
      }
      
      // Return empty results for auth-protected endpoints to prevent 401s for reviewers
      if (endpoint.includes('/coupons')) return [];
       if (endpoint.includes('/orders')) return [];
       if (endpoint.includes('/notifications')) return [];
       if (endpoint.includes('/addresses')) return [];
       if (endpoint.includes('/favorites')) return [];
       if (endpoint.includes('/cart')) return [];
       if (endpoint.includes('/profile')) return {};
       
       if (endpoint.includes('/auth/verify-otp')) {
        return {
          token: token,
          user: {
            id: 'reviewer-id-' + (token.includes('1987654321') ? '2' : '1'),
            phone: token.includes('1987654321') ? '+1987654321' : '+1234567890',
            name: token.includes('1987654321') ? 'Reviewer 2' : 'Google Play Reviewer',
            role: 'USER' // Always USER as requested
          }
        };
      }
    }
    
    // For admin routes, if token is missing, try to wait a bit or check store
    if (!token && endpoint.startsWith('/admin')) {
      console.warn(`[API] Admin request to ${endpoint} without token. Attempt ${attempt}`);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token && !token.startsWith('test-token-') ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const fullUrl = endpoint.startsWith('http') ? endpoint : `${currentBaseUrl}${endpoint}`;
    
    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000); // Default 60s timeout

    try {
      if (import.meta.env.DEV) {
        console.log(`[API Request] ${options.method || 'GET'} ${fullUrl}`, {
          hasAuth: !!headers['Authorization'],
          tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none',
          attempt
        });
      }
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // If we got any response from the server, it's not down
      if (useMaintenanceStore.getState().isServerDown) {
        console.log('[API] Server is back online!');
        useMaintenanceStore.getState().setServerDown(false);
      }

      const text = await response.text();
      let data: any = {};
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
        }
      }

      if (!response.ok) {
        // If it's a 401 or 403, don't retry, just throw
        if (response.status === 401 || response.status === 403) {
          // IMPORTANT: Only auto-logout if we ARE NOT currently trying to log in
          const isAuthRequest = endpoint.includes('/auth/me') || 
                               endpoint.includes('/auth/sync-supabase-user') || 
                               endpoint.includes('/auth/verify-otp');
          
          // Check if the token that failed is still the current token
          // This prevents "zombie" requests from old sessions from logging out a new session
          const currentToken = localStorage.getItem('auth_token')?.trim();
          const requestToken = headers['Authorization']?.replace('Bearer ', '')?.trim();
          
          // Don't log out if it's a test token
          if (requestToken?.startsWith('test-token-')) {
            console.warn('[API] 401 from test token, ignoring logout');
            throw new Error(`Test token unauthorized: ${endpoint}`);
          }

          if (currentToken && currentToken !== requestToken) {
            console.warn('[API] Detected 401 from old token, retrying with new token...');
            // Retry once with the current token
            if (authRetry < 1) {
              return executeRequest(attempt, authRetry + 1);
            }
          }

          if (!isAuthRequest && (currentToken === requestToken || !currentToken)) {
            // Clear local storage and dispatch event for global logout
            localStorage.removeItem('auth_token');
            window.dispatchEvent(new Event('auth-unauthorized'));
          }
          
          const errorMsg = data.error || data.message || `Unauthorized (${response.status})`;
          const debugInfo = token ? ` (Token: ${token.substring(0, 8)}...)` : ' (No Token)';
          throw new Error(`${errorMsg}${debugInfo}`);
        }

        // Only retry on certain status codes (e.g., 500, 502, 503, 504) or if it's a first load issue
        if (attempt < retries && (response.status >= 500 || response.status === 404)) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeRequest(attempt + 1, authRetry);
        }

        if (data && data.error) throw new Error(data.error);
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          throw new Error(`Server Error (${response.status}): The server returned an HTML error page.`);
        }
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (isGet) {
        persistentCache.set(cacheKey, data);
      } else {
        if (endpoint.includes('/products')) {
          persistentCache.invalidatePattern('/products');
          persistentCache.invalidatePattern('/admin/products');
        }
        if (endpoint.includes('/admin/products')) {
          persistentCache.invalidatePattern('/admin/products');
          persistentCache.invalidatePattern('/products');
        }
        if (endpoint.includes('/addresses')) persistentCache.invalidatePattern('/addresses');
        if (endpoint.includes('/cart')) persistentCache.invalidatePattern('/cart');
        if (endpoint.includes('/orders')) {
          persistentCache.invalidatePattern('/cart');
          persistentCache.invalidatePattern('/orders');
        }
        if (endpoint.includes('/auth/me')) persistentCache.invalidatePattern('/auth/me');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle Timeout
      if (error.name === 'AbortError') {
        console.warn(`[API Timeout] Request to ${endpoint} timed out after ${options.timeout || 30000}ms`);
        // We can treat timeout as a network error for retry purposes
        if (attempt < retries) {
           const delay = Math.pow(2, attempt) * 1000;
           await new Promise(resolve => setTimeout(resolve, delay));
           return executeRequest(attempt + 1, authRetry);
        }
        throw new Error('Request timed out. Please check your connection.');
      }

      // Check if it's a network error
      const isNetworkError = 
        error.name === 'TypeError' || 
        error.message.includes('NetworkError') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('Load failed');

      if (attempt < retries && isNetworkError) {
        if (currentBaseUrl.includes('localhost:5002/api')) {
          console.warn(`[API Fallback] localhost:5002 failed, trying localhost:5001...`);
          currentBaseUrl = 'http://localhost:5001/api';
        } else if (currentBaseUrl.includes('localhost:5000/api')) {
          console.warn(`[API Fallback] localhost:5000 failed, trying localhost:5001...`);
          currentBaseUrl = 'http://localhost:5001/api';
        }

        // Fallback logic for Android emulators
        const userAgent = navigator.userAgent.toLowerCase();
        const isAndroid = /android/i.test(userAgent);
        const override = localStorage.getItem('api_url_override');
        const normalizeOverride = (value: string) => value.endsWith('/api') ? value : `${value}/api`;
        const hostname = window.location.hostname;
        const isPrivateIp = (value: string) => /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(value);
        
        if (isAndroid && currentBaseUrl.includes('10.0.2.2')) {
          console.warn(`[API Fallback] 10.0.2.2 failed, trying 10.0.3.2...`);
          currentBaseUrl = 'http://10.0.3.2:5001/api';
        } else if (isAndroid && currentBaseUrl.includes('10.0.3.2')) {
          if (override) {
            console.warn(`[API Fallback] 10.0.3.2 failed, trying override...`);
            currentBaseUrl = normalizeOverride(override);
          } else if (hostname && hostname !== 'localhost' && hostname !== '10.0.2.2' && hostname !== '10.0.3.2' && isPrivateIp(hostname)) {
            console.warn(`[API Fallback] 10.0.3.2 failed, trying host IP ${hostname}...`);
            currentBaseUrl = `http://${hostname}:5001/api`;
          } else {
            console.warn(`[API Fallback] 10.0.3.2 failed, trying localhost...`);
            currentBaseUrl = 'http://localhost:5001/api';
          }
        } else if (isAndroid && currentBaseUrl.includes('192.168.2.228')) {
          if (override) {
            console.warn(`[API Fallback] 192.168.2.228 failed, trying override...`);
            currentBaseUrl = normalizeOverride(override);
          } else if (hostname && hostname !== 'localhost' && isPrivateIp(hostname)) {
            console.warn(`[API Fallback] 192.168.2.228 failed, trying host IP ${hostname}...`);
            currentBaseUrl = `http://${hostname}:5001/api`;
          } else {
            console.warn(`[API Fallback] 192.168.2.228 failed, trying localhost...`);
            currentBaseUrl = 'http://localhost:5001/api';
          }
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[API Network Error] Retrying ${endpoint} in ${delay}ms... (Attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeRequest(attempt + 1, authRetry);
      }

      if (isNetworkError) {
        console.error(`[API Network Error Details]
          Method: ${options.method || 'GET'}
          URL: ${fullUrl}
          Error: ${error.message}
        `);
        if (!skipMaintenanceTrigger) {
          useMaintenanceStore.getState().setServerDown(true, error.message, fullUrl);
        }
        throw new Error('Network Error: Could not connect to the server.');
      }
      throw error;
    }
  };

  return executeRequest(0, 0);
}

export function clearCache() {
  persistentCache.clear();
}

// Authentication functions using our server
export async function fetchMe() {
  try {
    const user = await request('/auth/me', { skipMaintenanceTrigger: true, skipCache: true });
    if (user && !user.name) {
      // If server returned user but no name, try to get it from Supabase
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (sbUser?.user_metadata?.full_name) {
        user.name = sbUser.user_metadata.full_name;
      } else if (sbUser?.email) {
        user.name = sbUser.email.split('@')[0];
      }
    }
    return user;
  } catch (err) {
    // If our server fails, try Supabase as fallback
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return {
      id: user.id,
      phone: user.phone || '',
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      role: 'USER',
    };
  }
}

export async function checkUser(phone: string) {
  return request(`/auth/check-user/${encodeURIComponent(phone)}`);
}

export async function checkEmail(email: string) {
  return request(`/auth/check-email/${encodeURIComponent(email)}`);
}

export async function signupWithEmail(email: string, password: string, name: string) {
  // Use Supabase Auth for signup
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) throw error;

  // After Supabase signup, we also sync with our backend to ensure Prisma record exists
  // But wait until email is verified for full access.
  // We call syncUser to create the initial record.
  try {
    await request('/auth/sync-supabase-user', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name,
        supabaseId: data.user?.id
      })
    });
  } catch (e) {
    console.warn('Backend sync failed (optional):', e);
  }

  return { 
    user: data.user, 
    session: data.session,
    message: 'تم إرسال رابط التحقق إلى بريدك الإلكتروني' 
  };
}

export async function loginWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // Sync with backend to get full user data (role, etc.)
  let serverResponse = null;
  try {
    serverResponse = await request('/auth/sync-supabase-user', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name: data.user?.user_metadata?.full_name,
        supabaseId: data.user?.id
      })
    });
  } catch (e) {
    console.warn('Login sync failed:', e);
  }

  if (data.session?.access_token) {
    localStorage.setItem('auth_token', data.session.access_token);
  }

  return {
    token: data.session?.access_token,
    user: serverResponse?.user ? {
      ...serverResponse.user,
      id: data.user?.id || serverResponse.user.id
    } : {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0],
      role: 'USER'
    }
  };
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return true;
}

export async function resetPassword(password: string) {
  const { error } = await supabase.auth.updateUser({
    password: password
  });
  if (error) throw error;
  return true;
}

export async function verifyEmailOTP(email: string, token: string, type: 'signup' | 'recovery' = 'signup') {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type
  });

  if (error) throw error;

  if (data.session?.access_token) {
    localStorage.setItem('auth_token', data.session.access_token);
  }

  // Final sync after OTP verification to get full user data
  let serverUser = null;
  try {
    serverUser = await request('/auth/sync-supabase-user', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name: data.user?.user_metadata?.full_name,
        supabaseId: data.user?.id
      })
    });
  } catch (e) {
    console.warn('Email OTP verification sync failed:', e);
  }

  return {
    token: data.session?.access_token,
    user: serverUser?.user ? {
      ...serverUser.user,
      id: data.user?.id || serverUser.user.id
    } : {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0],
      role: 'USER'
    }
  };
}

export async function resendEmailOTP(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email
  });

  if (error) throw error;
  return { message: 'تم إعادة إرسال كود التحقق بنجاح' };
}

export async function sendWhatsAppOTP(phone: string, name?: string) {
  return request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, name }),
  });
}

export async function verifyWhatsAppOTP(phone: string, code: string, fullName?: string) {
  return request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code, fullName }),
  });
}

export async function updateProfile(userData: { name: string; avatar?: string }) {
  // Update on our server
  const serverUpdate = await request('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(userData),
  });

  // Also update on Supabase for consistency if user is logged into Supabase
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: userData.name,
        avatar_url: userData.avatar
      }
    });
  } catch (e) {
    console.warn('Supabase profile update failed (optional):', e);
  }

  return serverUpdate;
}

export async function deleteAccount() {
  const response = await request('/auth/me', {
    method: 'DELETE',
  });
  
  // Also sign out from Supabase
  await supabase.auth.signOut();
  
  // Clear local storage
  localStorage.removeItem('auth_token');
  
  return response;
}

export async function verifyOTP(data: { phone: string; otp: string; type?: 'signup' | 'sms' }) {
  const { data: result, error } = await (supabase.auth as any).verifyOtp({
    phone: data.phone,
    token: data.otp,
    type: data.type || 'sms',
  });
  if (error) throw error;
  if (result.session) {
    localStorage.setItem('auth_token', result.session.access_token);
  }
  return result;
}

export async function resendOTP(data: { phone: string; type?: 'signup' | 'sms' }) {
  const { data: result, error } = await (supabase.auth as any).resend({
    type: data.type || 'sms',
    phone: data.phone,
  });
  if (error) throw error;
  return result;
}

export function logout() {
  localStorage.removeItem('auth_token');
  supabase.auth.signOut();
}

// --- Tracking Service ---
export const trackInteraction = async (productId: number | string, type: 'VIEW' | 'CART' | 'PURCHASE' | 'SHARE', weight: number = 1.0) => {
  try {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('session_id', sessionId);
    }

    await fetch(`${API_BASE_URL}/track`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        productId: Number(productId),
        type,
        weight,
        sessionId
      })
    });
  } catch (error) {
    // Silent fail for tracking
    console.warn('Tracking failed:', error);
  }
};

// --- Product API ---
export const fetchProducts = async (page = 1, limit = 20, search = '', maxPrice?: number) => {
  let url = `/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
  if (maxPrice !== undefined) {
    url += `&maxPrice=${maxPrice}`;
  }
  return request(url);
}

export async function fetchAdminProducts(page = 1, limit = 20, search = '', token?: string | null, skipCache = false) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search
  });
  
  const response = await request(`/admin/products?${queryParams.toString()}`, { token, skipCache });
  
  // If we are on the first page, we could potentially inject local drafts here too, 
  // but we are already doing it in the component. Let's keep it consistent.
  return response;
}

export async function checkProductExistence() {
  return request('/admin/products/check-existence');
}

export async function fetchProductById(id: number | string) {
  if (typeof id === 'string' && id.startsWith('local-')) {
    const draft = localProductService.getDraftById(id);
    if (draft) return draft;
    throw new Error('Local draft not found');
  }
  const data = await request(`/products/${id}`, { skipCache: true });

  // Fix for Pinduoduo scraper: If generated_options exists, use it to populate/fix variants
  // This ensures options show up correctly even if relational tables are malformed
  if (data && data.generated_options && Array.isArray(data.generated_options) && data.generated_options.length > 0) {
    // Check if variants are missing or malformed (e.g. combination is just a string)
    const needsFix = !data.variants || data.variants.length === 0 || data.variants.some((v: any) => {
      try {
        const c = typeof v.combination === 'string' ? JSON.parse(v.combination) : v.combination;
        return !c || Object.keys(c).length === 0;
      } catch { return true; }
    });

    if (needsFix) {
      console.log('[API] Rebuilding variants from generated_options');
      data.variants = data.generated_options.map((opt: any, idx: number) => ({
        id: opt.id || `gen-${idx}`,
        productId: data.id,
        // Standardize combination as a proper object
        combination: { "الخيار": opt.color }, 
        price: typeof opt.price === 'number' ? opt.price : parseFloat(opt.price || '0'),
        stock: typeof opt.quantity === 'number' ? opt.quantity : parseInt(opt.quantity || '0'),
        image: opt.thumbnail,
        originalPrice: opt.originalPrice,
      }));

      // Ensure options metadata exists for the UI to render selectors
      if (!data.options || data.options.length === 0) {
        const uniqueColors = Array.from(new Set(data.generated_options.map((o: any) => o.color)));
        data.options = [{
          id: 1,
          name: "الخيار",
          values: uniqueColors
        }];
      }
    }
  }

  return data;
}

export async function searchProducts(query: string, page = 1, limit = 20) {
  try {
    const data = await request(`/products?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`);
    if (data && typeof data === 'object') {
      if (Array.isArray(data.products) && data.products.length === 0 && page === 1) {
        return request(`/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
      }
      const totalPages = typeof data.totalPages === 'number' ? data.totalPages : undefined;
      return {
        ...data,
        hasMore: totalPages ? page < totalPages : (data.hasMore ?? undefined),
      };
    }
    return data;
  } catch (_e) {
    return request(`/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  }
}

// Admin: Products
export async function createProduct(productData: any) {
  // If status is DRAFT, save locally instead of server
  if (productData.status === 'DRAFT') {
    return localProductService.saveDraft(productData);
  }

  return request('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
}

export async function updateProduct(id: number | string, productData: any, token?: string | null) {
  // If it's a local draft (ID starts with local-)
  if (typeof id === 'string' && id.startsWith('local-')) {
    // If user changed status to PUBLISHED, create on server and delete local
    if (productData.status === 'PUBLISHED') {
      const draft = localProductService.getDraftById(id);
      if (!draft) {
        throw new Error('لم يتم العثور على المسودة محلياً');
      }
      
      // Merge draft data with updates
      const fullProductData = { ...draft, ...productData };
      
      // Clean up for server (remove local-only fields)
      const { id: _, isLocal: __, createdAt: ___, updatedAt: ____, ...rest } = fullProductData;
      
      const result = await request('/products', {
        method: 'POST',
        body: JSON.stringify(rest),
        token
      });
      localProductService.deleteDraft(id);
      return result;
    }
    
    // Otherwise just update locally
    return localProductService.saveDraft({ ...productData, id });
  }

  return request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
    token
  });
}

export async function deleteProduct(id: number | string, token?: string | null) {
  if (typeof id === 'string' && id.startsWith('local-')) {
    localProductService.deleteDraft(id);
    return { success: true };
  }

  return request(`/products/${id}`, { method: 'DELETE', token });
}

// Admin: Orders
export async function fetchAdminOrders(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  province?: string;
  search?: string;
  page?: number;
  limit?: number;
}, token?: string | null) {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
  }
  return request(`/admin/orders?${queryParams.toString()}`, { token });
}

export async function fetchAdminOrderDetails(orderId: string | number, token?: string | null) {
  return request(`/admin/orders/${orderId}`, { token });
}

// Admin: Stats
export async function fetchAdminStats(token?: string | null) {
  return request('/admin/stats', { token });
}

// Admin: Users
export async function fetchAdminUsers(page = 1, limit = 20, search = '', token?: string | null) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search
  });
  return request(`/admin/users?${queryParams.toString()}`, { token });
}

export async function updateUserRole(userId: string | number, role: string, token?: string | null) {
  return request(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
    token
  });
}

// Admin: Coupons/Discounts
export async function fetchAdminCoupons(token?: string | null) {
  return request('/admin/coupons', { token });
}

export async function createCoupon(couponData: any, token?: string | null) {
  return request('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(couponData),
    token
  });
}

export async function updateCoupon(id: number | string, couponData: any, token?: string | null) {
  return request(`/admin/coupons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(couponData),
    token
  });
}

export async function deleteCoupon(id: number | string, token?: string | null) {
  return request(`/admin/coupons/${id}`, {
    method: 'DELETE',
    token
  });
}

export async function updateUserPermissions(userId: string | number, permissions: string[], token?: string | null) {
  return request(`/admin/users/${userId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
    token
  });
}

// Admin: Reports
export async function fetchReportSummary(period: string = 'monthly') {
  return request(`/admin/reports/summary?period=${period}`);
}

export async function sendTestReport() {
  return request('/admin/reports/send-test', { method: 'POST' });
}

// User: Coupons
export async function validateCoupon(code: string, orderAmount: number) {
  return request('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, orderAmount }),
  });
}

export async function fetchCoupons() {
  return request('/coupons', { skipMaintenanceTrigger: true });
}

// --- Review functions ---
export async function fetchProductReviews(productId: number | string) {
  return request(`/products/${productId}/reviews`);
}

export async function addProductReview(productId: number | string, rating: number, comment: string, images?: string[]) {
  return request(`/products/${productId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment, images })
  });
}

export async function checkProductPurchase(productId: number | string) {
  try {
    return await request(`/products/${productId}/check-purchase`, { skipMaintenanceTrigger: true });
  } catch (err) {
    return { purchased: false };
  }
}

// Admin: Banners
export async function fetchBanners() {
  return request('/banners');
}

export async function createBanner(bannerData: any) {
  return request('/admin/banners', {
    method: 'POST',
    body: JSON.stringify(bannerData),
  });
}

export async function updateBanner(id: number | string, bannerData: any) {
  return request(`/admin/banners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(bannerData),
  });
}

export async function deleteBanner(id: number | string) {
  return request(`/admin/banners/${id}`, { method: 'DELETE' });
}

// Admin: Settings
export async function fetchSettings(options: { skipCache?: boolean } = {}) {
  return request('/settings', { skipCache: options.skipCache });
}

export async function updateSettings(settingsData: any, token?: string | null) {
  const response = await request('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settingsData),
    token
  });
  // Clear settings cache after update
  persistentCache.delete('/settings');
  return response;
}

// Admin: AI Estimation
export async function estimateDimensions(productIds?: (number | string)[], token?: string | null) {
  return request('/admin/products/estimate-dimensions', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
    token
  });
}

// Admin: User Details
export async function fetchUserDetails(id: string | number) {
  return request(`/admin/users/${id}`);
}

// Admin: Activity Logs
export async function fetchActivityLogs() {
  return request('/admin/activity-logs');
}

// Admin: Notifications
export async function fetchAdminNotifications(token?: string | null) {
  return request('/admin/notifications', { token });
}

// User Notifications
export async function fetchUserNotifications() {
  return request('/notifications');
}

export async function markUserNotificationAsRead(id: number | string) {
  return request(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllUserNotificationsAsRead() {
  return request('/notifications/read-all', { method: 'PUT' });
}

export async function deleteUserNotification(id: number | string) {
  return request(`/notifications/${id}`, { method: 'DELETE' });
}

export async function clearAllUserNotifications() {
  return request('/notifications', { method: 'DELETE' });
}

// Admin: Abandoned Carts
export async function fetchAbandonedCarts() {
  return request('/admin/reports/abandoned-carts');
}

export async function updateOrderStatus(id: number | string, status: string, token?: string | null) {
  return request(`/admin/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
    token
  });
}

export async function updateOrderNote(id: number | string, note: string, token?: string | null) {
  return request(`/admin/orders/${id}/note`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
    token
  });
}

export async function updateOrderInternationalFee(id: number | string, fee: number, token?: string | null) {
  return request(`/admin/orders/${id}/international-fee`, {
    method: 'PUT',
    body: JSON.stringify({ fee }),
    token
  });
}

export async function updateProductPrice(data: { productId: number; variantId?: number | null; newPrice: number }, token?: string | null) {
  return request('/admin/products/update-price', {
    method: 'PUT',
    body: JSON.stringify(data),
    token
  });
}

export async function fetchAdminReviews(token?: string | null) {
  return request('/admin/reviews', { token });
}

export async function deleteReview(id: number | string, token?: string | null) {
  return request(`/admin/reviews/${id}`, { method: 'DELETE', token });
}

// Addresses
export async function fetchAddresses() {
  return request('/addresses', { skipMaintenanceTrigger: true });
}

export async function fetchAddressById(id: number | string) {
  return request(`/addresses/${id}`);
}

export async function createAddress(addressData: any) {
  return request('/addresses', {
    method: 'POST',
    body: JSON.stringify(addressData),
  });
}

export async function updateAddress(id: number | string, addressData: any) {
  return request(`/addresses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(addressData),
  });
}

export async function deleteAddress(id: number | string) {
  return request(`/addresses/${id}`, { method: 'DELETE' });
}

export async function markNotificationAsRead(id: number | string) {
  return request(`/admin/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsAsRead(token?: string | null) {
  return request('/admin/notifications/read-all', { method: 'PUT', token });
}

// Admin: Bulk Actions
export async function bulkUpdateProductStatus(ids: (number | string)[], isActive: boolean, token?: string | null) {
  return request('/admin/products/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, isActive }),
    token
  });
}

export async function bulkDeleteProducts(ids: (number | string)[], token?: string | null) {
  const localIds = ids.filter(id => typeof id === 'string' && id.startsWith('local-')) as string[];
  const serverIds = ids.filter(id => !(typeof id === 'string' && id.startsWith('local-')));

  if (localIds.length > 0) {
    localIds.forEach(id => localProductService.deleteDraft(id));
  }

  if (serverIds.length === 0) return { success: true };

  return request('/admin/products/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids: serverIds }),
    token
  });
}

export async function bulkUpdateOrderStatus(ids: (number | string)[], status: string, token?: string | null) {
  return request('/admin/orders/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
    token
  });
}

// Admin: Safe Import Workflow
export async function bulkImportProducts(products: any[], token?: string | null) {
  return request('/products/bulk', {
    method: 'POST',
    body: JSON.stringify({ products }),
    token
  });
}

export async function enqueueBulkImportProducts(products: any[], token?: string | null) {
  return request('/admin/products/bulk-import-jobs', {
    method: 'POST',
    body: JSON.stringify({ products }),
    token
  });
}

export async function fetchBulkImportJob(jobId: string, token?: string | null) {
  return request(`/admin/products/bulk-import-jobs/${jobId}`, {
    token
  });
}

export async function bulkImportReviews(reviews: any[], token?: string | null) {
  return request('/admin/products/bulk-import-reviews', {
    method: 'POST',
    body: JSON.stringify({ reviews }),
    token
  });
}

export async function saveProductOptions(productId: number | string, options: any[], variants: any[], token?: string | null) {
  if (typeof productId === 'string' && productId.startsWith('local-')) {
    const draft = localProductService.getDraftById(productId);
    if (draft) {
      localProductService.saveDraft({
        ...draft,
        options,
        variants
      });
      return { success: true };
    }
  }

  return request(`/admin/products/${productId}/options`, {
    method: 'PUT',
    body: JSON.stringify({ options, variants }),
    token
  });
}

export async function bulkPublishProducts(ids: (number | string)[], token?: string | null) {
  const localIds = ids.filter(id => typeof id === 'string' && id.startsWith('local-')) as string[];
  const serverIds = ids.filter(id => !(typeof id === 'string' && id.startsWith('local-')));

  // For local drafts, we need to actually create them on the server one by one
  // or use a bulk create if available. For now, let's use createProduct logic.
  if (localIds.length > 0) {
    for (const id of localIds) {
      const draft = localProductService.getDraftById(id);
      if (draft) {
        const { id: _, options, variants, ...rest } = draft;
        // Create product on server
        const result = await request('/products', {
          method: 'POST',
          body: JSON.stringify({ ...rest, status: 'PUBLISHED', isActive: true }),
          token
        });
        
        // If draft had options or variants, save them too
        if ((options && options.length > 0) || (variants && variants.length > 0)) {
          await saveProductOptions(result.id, options || [], variants || [], token);
        }
        
        localProductService.deleteDraft(id);
      }
    }
  }

  if (serverIds.length === 0) return { success: true };

  return request('/admin/products/bulk-publish', {
    method: 'POST',
    body: JSON.stringify({ ids: serverIds }),
    token
  });
}

export async function bulkCreateProducts(products: any[], token?: string | null) {
  return request('/admin/products/bulk-create', {
    method: 'POST',
    body: JSON.stringify({ products }),
    token
  });
}

// Cart
export async function fetchCart() {
  return request('/cart');
}

export async function addToCart(productId: number | string, quantity: number = 1, variantId?: number | string, selectedOptions?: any, shippingMethod: string = 'air') {
  return request('/cart', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, variantId, selectedOptions, shippingMethod }),
  });
}

export async function updateCartItem(id: number | string, quantity: number) {
  return request(`/cart/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeFromCart(id: number | string) {
  return request(`/cart/${id}`, { method: 'DELETE' });
}

// Orders
export async function calculateShipping(items: any[], method: string = 'sea') {
  return request('/shipping/calculate', {
    method: 'POST',
    body: JSON.stringify({ items, method }),
  });
}

export async function placeOrder(addressId: number | string, paymentMethod: string, shippingMethod: string, couponCode?: string, items?: any[]) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify({ addressId, paymentMethod, shippingMethod, couponCode, items }),
  });
}

export async function fetchOrders() {
  // Use a cache-busting timestamp for orders to ensure we get fresh status updates
  return request(`/orders?_t=${Date.now()}`, { skipMaintenanceTrigger: true });
}

export async function fetchOrderById(id: number | string) {
  return request(`/orders/${id}?_t=${Date.now()}`, { skipMaintenanceTrigger: true });
}

export async function confirmOrderPayment(id: number | string) {
  return request(`/orders/${id}/confirm-payment`, {
    method: 'PUT',
  });
}

export async function cancelOrder(id: number | string) {
  return request(`/orders/${id}/cancel`, { method: 'PUT' });
}

// Wishlist - Replaced by local storage in useWishlistStore.ts
/*
export async function fetchWishlist() {
  return request('/wishlist');
}

export async function addToWishlist(productId: number | string) {
  return request('/wishlist', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export async function removeFromWishlist(productId: number | string) {
  return request(`/wishlist/${productId}`, { method: 'DELETE' });
}
*/

// Messages
export async function fetchMessages(orderId: number | string) {
  return request(`/messages/${orderId}`);
}

export async function fetchAdminMessages(token?: string | null) {
  return request('/admin/messages', { token });
}

export async function sendMessage(orderId: number | string, text: string) {
  return request('/messages', {
    method: 'POST',
    body: JSON.stringify({ orderId, text }),
  });
}
