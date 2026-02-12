import { useMemo } from 'react';

const SMART_PANTRY_SQL_SETUP_SCRIPT = `-- SCRIPT DE INICIALIZAÇÃO SMART PANTRY
-- Copie e cole no SQL Editor do seu Dashboard do Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  pantry_id TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantry_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  current_quantity NUMERIC DEFAULT 0,
  min_quantity NUMERIC DEFAULT 0,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_pantry_id ON public.pantry_items(pantry_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para profiles" ON public.profiles;
CREATE POLICY "Permitir tudo para profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para pantry_items" ON public.pantry_items;
CREATE POLICY "Permitir tudo para pantry_items" ON public.pantry_items FOR ALL USING (true) WITH CHECK (true);
`;

const getSupabaseDashboardUrl = (supabaseUrl: string) => supabaseUrl.replace('https://', 'https://app.supabase.com/project/');

export const useDatabaseSetup = ({ supabaseUrl }: { supabaseUrl: string }) => {
  const sqlSetupScript = useMemo(() => SMART_PANTRY_SQL_SETUP_SCRIPT, []);
  const supabaseDashboardUrl = useMemo(() => getSupabaseDashboardUrl(supabaseUrl), [supabaseUrl]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlSetupScript);
      alert('Script SQL copiado com sucesso!');
    } catch (error) {
      console.error('Erro ao copiar SQL:', error);
      alert('Não foi possível copiar automaticamente. Selecione e copie o SQL manualmente.');
    }
  };

  return {
    sqlSetupScript,
    supabaseDashboardUrl,
    handleCopySql
  };
};
