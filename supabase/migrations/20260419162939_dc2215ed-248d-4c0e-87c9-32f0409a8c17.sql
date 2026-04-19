-- 1) agency_wallets: remove user-facing UPDATE/SELECT, keep service_role + platform admin
DROP POLICY IF EXISTS "Users can update own wallet" ON public.agency_wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.agency_wallets;

-- Re-add a safe read-only SELECT for users (no UPDATE) so the UI can still display balance
CREATE POLICY "Users can view own wallet (read-only)"
ON public.agency_wallets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) call-audio bucket: make private and restrict reads to owner
UPDATE storage.buckets SET public = false WHERE id = 'call-audio';

-- Drop any existing public select policies for this bucket (best-effort: by common names)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND (qual ILIKE '%call-audio%' OR with_check ILIKE '%call-audio%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;

-- Owner-scoped policies. Files must be uploaded under "<auth.uid()>/..." prefix.
CREATE POLICY "Users read own call-audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'call-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload own call-audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'call-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own call-audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'call-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own call-audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'call-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Lock search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;