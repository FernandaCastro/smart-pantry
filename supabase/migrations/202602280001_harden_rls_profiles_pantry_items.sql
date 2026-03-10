-- Harden RLS policies for production environments.
-- This migration replaces legacy permissive policies and applies scoped auth.uid()-based access.

-- Ensure collaborator table exists (for shared pantry authorization checks)
CREATE TABLE IF NOT EXISTS public.pantry_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pantry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pantry_collaborators_pantry_id
  ON public.pantry_collaborators (pantry_id);

CREATE INDEX IF NOT EXISTS idx_pantry_collaborators_user_id
  ON public.pantry_collaborators (user_id);

-- Ensure RLS is active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_collaborators ENABLE ROW LEVEL SECURITY;

-- Remove permissive legacy policies
DROP POLICY IF EXISTS "Allow all to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all to pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Permitir tudo para profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir tudo para pantry_items" ON public.pantry_items;

-- Recreate scoped policies idempotently
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

DROP POLICY IF EXISTS "collaborators_select_scoped" ON public.pantry_collaborators;
CREATE POLICY "collaborators_select_scoped"
ON public.pantry_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::text
      AND (p.pantry_id = pantry_collaborators.pantry_id OR p.id = pantry_collaborators.user_id)
  )
);

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
