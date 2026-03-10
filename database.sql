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


-- Segurança: senha não deve existir em tabela de domínio quando Supabase Auth é usado
-- Remove coluna legada, se existir em ambientes antigos
ALTER TABLE IF EXISTS public.profiles
  DROP COLUMN IF EXISTS password;

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

-- 3.1 Tabela de colaboradores da despensa
-- Permite compartilhamento seguro de despensa entre usuários
CREATE TABLE IF NOT EXISTS public.pantry_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pantry_id, user_id)
);

-- 4. Criação de Índices para Otimização
-- Melhora a velocidade de busca por e-mail e ID da despensa
CREATE INDEX IF NOT EXISTS idx_pantry_items_pantry_id ON public.pantry_items(pantry_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_pantry_collaborators_pantry_id ON public.pantry_collaborators(pantry_id);
CREATE INDEX IF NOT EXISTS idx_pantry_collaborators_user_id ON public.pantry_collaborators(user_id);

-- 5. Habilitar Row Level Security (RLS)
-- Garante que o banco de dados tenha camadas de proteção habilitadas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_collaborators ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Acesso Seguras para Produção
-- Remove políticas permissivas legadas
DROP POLICY IF EXISTS "Allow all to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all to pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Permitir tudo para profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir tudo para pantry_items" ON public.pantry_items;

-- Profiles: usuário só acessa seu próprio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid()::text)
WITH CHECK (id = auth.uid()::text);

-- Collaborators: leitura permitida para dono da despensa e colaborador envolvido
DROP POLICY IF EXISTS "collaborators_select_scoped" ON public.pantry_collaborators;
CREATE POLICY "collaborators_select_scoped"
ON public.pantry_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_collaborators.pantry_id
        OR p.id = pantry_collaborators.user_id
      )
  )
);

-- Pantry items: apenas dono/colaborador da mesma despensa pode acessar/modificar
DROP POLICY IF EXISTS "pantry_items_select_scoped" ON public.pantry_items;
CREATE POLICY "pantry_items_select_scoped"
ON public.pantry_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_items.pantry_id
        OR EXISTS (
          SELECT 1
          FROM public.pantry_collaborators c
          WHERE c.pantry_id = pantry_items.pantry_id
            AND c.user_id = p.id
        )
      )
  )
);

DROP POLICY IF EXISTS "pantry_items_insert_scoped" ON public.pantry_items;
CREATE POLICY "pantry_items_insert_scoped"
ON public.pantry_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_items.pantry_id
        OR EXISTS (
          SELECT 1
          FROM public.pantry_collaborators c
          WHERE c.pantry_id = pantry_items.pantry_id
            AND c.user_id = p.id
        )
      )
  )
);

DROP POLICY IF EXISTS "pantry_items_update_scoped" ON public.pantry_items;
CREATE POLICY "pantry_items_update_scoped"
ON public.pantry_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_items.pantry_id
        OR EXISTS (
          SELECT 1
          FROM public.pantry_collaborators c
          WHERE c.pantry_id = pantry_items.pantry_id
            AND c.user_id = p.id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_items.pantry_id
        OR EXISTS (
          SELECT 1
          FROM public.pantry_collaborators c
          WHERE c.pantry_id = pantry_items.pantry_id
            AND c.user_id = p.id
        )
      )
  )
);

DROP POLICY IF EXISTS "pantry_items_delete_scoped" ON public.pantry_items;
CREATE POLICY "pantry_items_delete_scoped"
ON public.pantry_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (
        p.pantry_id = pantry_items.pantry_id
        OR EXISTS (
          SELECT 1
          FROM public.pantry_collaborators c
          WHERE c.pantry_id = pantry_items.pantry_id
            AND c.user_id = p.id
        )
      )
  )
);

-- 7. Comentário de Sucesso
-- Se você vê esta linha, o script foi formatado corretamente.
