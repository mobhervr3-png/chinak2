import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import packageJson from '../package.json';

// Version Check & Cache Busting
try {
  const CURRENT_VERSION = packageJson.version;
  const STORED_VERSION_KEY = 'app_version';
  const storedVersion = localStorage.getItem(STORED_VERSION_KEY);

  if (storedVersion !== CURRENT_VERSION) {
    console.log(`New version detected: ${CURRENT_VERSION} (was ${storedVersion}). Clearing cache.`);
    
    // Clear all local storage except critical auth tokens if needed (or clear all to be safe)
    // For now, we clear everything to ensure fresh state
    localStorage.clear();
    
    // Clear session storage
    sessionStorage.clear();
    
    // Update version
    localStorage.setItem(STORED_VERSION_KEY, CURRENT_VERSION);
    
    // Force reload if we are in a browser environment
    if (window.location.search.indexOf('v=' + CURRENT_VERSION) === -1) {
       // Optional: Reload with version query param to bypass browser cache
       // window.location.href = window.location.pathname + '?v=' + CURRENT_VERSION;
    }
  }
} catch (e) {
  console.error('Version check failed:', e);
}

// Immediate LocalStorage Cleanup to prevent QuotaExceededError
try {
  const CACHE_PREFIX = 'app_cache_';
  const keys = Object.keys(localStorage);
  const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  
  // If we have many cache keys, clear them all immediately before App starts
  if (cacheKeys.length > 10) {
    cacheKeys.forEach(k => localStorage.removeItem(k));
  }
} catch (e) {
  // Ignore localStorage errors here
}

try {
  if (!CSS.supports('color', 'oklch(0% 0 0)')) {
    const fallbackVars: Record<string, string> = {
      '--color-slate-50': '#f8fafc',
      '--color-slate-100': '#f1f5f9',
      '--color-slate-200': '#e2e8f0',
      '--color-slate-300': '#cbd5e1',
      '--color-slate-400': '#94a3b8',
      '--color-slate-500': '#64748b',
      '--color-slate-600': '#475569',
      '--color-slate-700': '#334155',
      '--color-slate-800': '#1e293b',
      '--color-slate-900': '#0f172a',
      '--color-slate-950': '#020617',

      '--color-gray-50': '#f9fafb',
      '--color-gray-100': '#f3f4f6',
      '--color-gray-200': '#e5e7eb',
      '--color-gray-300': '#d1d5db',
      '--color-gray-400': '#9ca3af',
      '--color-gray-500': '#6b7280',
      '--color-gray-600': '#4b5563',
      '--color-gray-700': '#374151',
      '--color-gray-800': '#1f2937',
      '--color-gray-900': '#111827',
      '--color-gray-950': '#030712',

      '--color-rose-50': '#fff1f2',
      '--color-rose-100': '#ffe4e6',
      '--color-rose-200': '#fecdd3',
      '--color-rose-300': '#fda4af',
      '--color-rose-400': '#fb7185',
      '--color-rose-500': '#f43f5e',
      '--color-rose-600': '#e11d48',
      '--color-rose-700': '#be123c',
      '--color-rose-800': '#9f1239',
      '--color-rose-900': '#881337',
      '--color-rose-950': '#4c0519',

      '--color-blue-50': '#eff6ff',
      '--color-blue-100': '#dbeafe',
      '--color-blue-200': '#bfdbfe',
      '--color-blue-300': '#93c5fd',
      '--color-blue-400': '#60a5fa',
      '--color-blue-500': '#3b82f6',
      '--color-blue-600': '#2563eb',
      '--color-blue-700': '#1d4ed8',
      '--color-blue-800': '#1e40af',
      '--color-blue-900': '#1e3a8a',
      '--color-blue-950': '#172554',

      '--color-green-50': '#f0fdf4',
      '--color-green-100': '#dcfce7',
      '--color-green-200': '#bbf7d0',
      '--color-green-300': '#86efac',
      '--color-green-400': '#4ade80',
      '--color-green-500': '#22c55e',
      '--color-green-600': '#16a34a',
      '--color-green-700': '#15803d',
      '--color-green-800': '#166534',
      '--color-green-900': '#14532d',
      '--color-green-950': '#052e16',

      '--color-amber-50': '#fffbeb',
      '--color-amber-100': '#fef3c7',
      '--color-amber-200': '#fde68a',
      '--color-amber-300': '#fcd34d',
      '--color-amber-400': '#fbbf24',
      '--color-amber-500': '#f59e0b',
      '--color-amber-600': '#d97706',
      '--color-amber-700': '#b45309',
      '--color-amber-800': '#92400e',
      '--color-amber-900': '#78350f',
      '--color-amber-950': '#451a03',
    };

    for (const [key, value] of Object.entries(fallbackVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
} catch (_e) {}

// Disable console.log in production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
