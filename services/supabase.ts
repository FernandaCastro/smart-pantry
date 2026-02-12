import { createClient } from '@supabase/supabase-js';

const APP_ENV = import.meta.env;

export const SUPABASE_URL = APP_ENV.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = APP_ENV.VITE_SUPABASE_ANON_KEY || APP_ENV.VITE_SUPABASE_KEY || '';

export const IS_CONFIGURED = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'));

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder'
);
