import { createClient } from '@supabase/supabase-js';

const APP_ENV = import.meta.env;

export const SUPABASE_URL = APP_ENV.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = APP_ENV.VITE_SUPABASE_ANON_KEY || '';

export const IS_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));

const sessionStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage: sessionStorageAdapter,
      persistSession: true,
    },
  }
);
