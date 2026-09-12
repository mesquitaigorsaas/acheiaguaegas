-- ============================================================
-- 002-logos.sql — o lugar das logos das revendas
--
-- Rode depois do policies.sql.
--
-- O balde é PÚBLICO para leitura: a logo aparece no cartão da
-- busca, para quem não está logado. Não tem nada de secreto
-- dentro — é a fachada da loja, que já está na rua.
--
-- Escrever é outra coisa. Só o dono, e só no arquivo da PRÓPRIA
-- revenda. Sem essa trava, um assinante trocaria a logo do
-- concorrente pelo que quisesse.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;


-- O nome do arquivo é o id da revenda mais a extensão. Guardar
-- assim faz o envio seguinte SUBSTITUIR o anterior, em vez de
-- acumular imagem órfã que ninguém apaga — e é o que permite a
-- regra abaixo saber de quem é o arquivo só olhando o nome.
drop policy if exists "qualquer um vê as logos" on storage.objects;
create policy "qualquer um vê as logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'logos');


drop policy if exists "o dono envia a logo dele" on storage.objects;
create policy "o dono envia a logo dele"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    -- split_part corta no ponto: "abc-123.png" vira "abc-123".
    and split_part(name, '.', 1) = minha_revenda()::text
  );


drop policy if exists "o dono troca a logo dele" on storage.objects;
create policy "o dono troca a logo dele"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and split_part(name, '.', 1) = minha_revenda()::text)
  with check (bucket_id = 'logos' and split_part(name, '.', 1) = minha_revenda()::text);


drop policy if exists "o dono apaga a logo dele" on storage.objects;
create policy "o dono apaga a logo dele"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and split_part(name, '.', 1) = minha_revenda()::text);
