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
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Itens da Despensa
-- Armazena os produtos, quantidades e limites de estoque
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

-- 6. Políticas de Acesso (Configuração de Permissão Total)
-- Nota: Para este App, estamos permitindo que o cliente gerencie seus dados.
-- Em um ambiente de produção real, usaríamos auth.uid() para filtrar.

DROP POLICY IF EXISTS "Permitir tudo para profiles" ON public.profiles;
CREATE POLICY "Permitir tudo para profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para pantry_items" ON public.pantry_items;
CREATE POLICY "Permitir tudo para pantry_items" ON public.pantry_items FOR ALL USING (true) WITH CHECK (true);

-- 7. Comentário de Sucesso
-- Se você vê esta linha, o script foi formatado corretamente.