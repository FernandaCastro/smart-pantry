-- Secure RLS policies for Smart Pantry
-- Assumptions:
-- 1) `profiles.id` stores Supabase Auth user id (`auth.uid()::text`)
-- 2) pantry access is scoped by `pantry_id`
-- 3) collaborators are stored in `public.pantry_collaborators`

-- Optional collaborator table (safe to create if missing)
CREATE TABLE IF NOT EXISTS public.pantry_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pantry_id, user_id)
);

ALTER TABLE public.pantry_collaborators ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies
DROP POLICY IF EXISTS "Allow all to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all to pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Permitir tudo para profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir tudo para pantry_items" ON public.pantry_items;

-- Profiles: users can only see/update their own row
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (id = auth.uid()::text);

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid()::text);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid()::text)
WITH CHECK (id = auth.uid()::text);

-- Pantry collaborators: owner or listed collaborator can read
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

-- Pantry items: only same pantry owner/collaborator can read/write
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
