-- Cria o bucket de avatares de usuários
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Usuário autenticado pode fazer upload apenas na sua própria pasta
create policy "Avatar upload próprio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário autenticado pode atualizar apenas o próprio avatar
create policy "Avatar update próprio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário autenticado pode deletar apenas o próprio avatar
create policy "Avatar delete próprio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (bucket já é público, mas política explícita para anon)
create policy "Avatar leitura pública"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
