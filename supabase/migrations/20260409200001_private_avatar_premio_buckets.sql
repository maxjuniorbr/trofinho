-- Make avatar and premio buckets private.
-- Child photos and family prize images should not be publicly accessible.
-- After this migration, all reads require authentication via signed URLs.

-- 1. Set buckets to private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';
UPDATE storage.buckets SET public = false WHERE id = 'premios';

-- 2. Drop public SELECT policies
DROP POLICY "Avatar leitura pública" ON storage.objects;
DROP POLICY "Premios leitura pública" ON storage.objects;

-- 3. Add authenticated SELECT policies scoped to the user's family

-- Avatars: user can read own avatar + family members' avatars
CREATE POLICY "Avatar leitura familia" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    -- Own avatar folder
    (storage.foldername(name))[1] = auth.uid()::text
    -- Family members' avatars (via usuarios table)
    OR (storage.foldername(name))[1] IN (
      SELECT u.id::text
      FROM public.usuarios u
      WHERE u.familia_id = public.minha_familia_id()
    )
    -- Child avatar subfolder (filhos/{child_id}/...)
    OR (
      (storage.foldername(name))[1] = 'filhos'
      AND EXISTS (
        SELECT 1
        FROM public.filhos f
        WHERE f.id::text = (storage.foldername(name))[2]
          AND f.familia_id = public.minha_familia_id()
      )
    )
  )
);

-- Premios: any family member can read prize images belonging to their family
CREATE POLICY "Premios leitura familia" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'premios'
  AND EXISTS (
    SELECT 1
    FROM public.premios p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.familia_id = public.minha_familia_id()
  )
);
