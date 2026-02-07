-- SCRIPT DE INICIALIZAÇÃO SMART PANTRY
-- Copie e cole este script no "SQL Editor" do seu Dashboard do Supabase e clique em "Run"

-- 1. Habilitar extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Perfis de Usuário
-- Armazena informações da conta e vincula à despensa única
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  pantry_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Itens da Despensa
-- Armazena os produtos, quantidades e limites de estoque

ALTER TABLE public.profiles DROP COLUMN IF EXISTS password;

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

-- 4. Criação de Índices para Otimização
-- Melhora a velocidade de busca por e-mail e ID da despensa
CREATE INDEX IF NOT EXISTS idx_pantry_items_pantry_id ON public.pantry_items(pantry_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 5. Habilitar Row Level Security (RLS)
-- Garante que o banco de dados tenha camadas de proteção habilitadas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Acesso (Apenas dono autenticado)
-- Perfis: somente o usuário autenticado pode ler/escrever seu próprio registro.
-- Itens da despensa: somente usuários cujo profile aponta para o pantry_id do item.

DROP POLICY IF EXISTS "Profiles owner access" ON public.profiles;
CREATE POLICY "Profiles owner access"
ON public.profiles FOR ALL
USING ((auth.uid())::text = id)
WITH CHECK ((auth.uid())::text = id);

DROP POLICY IF EXISTS "Pantry items owner access" ON public.pantry_items;
CREATE POLICY "Pantry items owner access"
ON public.pantry_items FOR ALL
USING (pantry_id IN (SELECT pantry_id FROM public.profiles WHERE id = (auth.uid())::text))
WITH CHECK (pantry_id IN (SELECT pantry_id FROM public.profiles WHERE id = (auth.uid())::text));

-- 7. Comentário de Sucesso
-- Se você vê esta linha, o script foi formatado corretamente.