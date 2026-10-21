-- `app_nome_escritorio_em_uso` sem o `SET app.bypass_rls = 'on'` na definição.
--
-- Fixar um parâmetro próprio (`app.*`) na função exige superusuário, e o dono
-- do banco gerenciado (Neon) não é: a migration de origem
-- (20261015120000_nome_escritorio_unico) falhava com "permission denied to set
-- parameter".
--
-- A função não precisa dele: é SECURITY DEFINER, roda com os direitos do dono
-- do banco, e o dono ignora o RLS — superusuário no Postgres local, BYPASSRLS
-- no Neon. Continua vendo todos os escritórios e devolvendo só sim ou não.
-- Se um dia o dono não ignorar o RLS, a resposta vira "livre" e quem segura o
-- nome repetido é o índice `organizacao_nome_unico`, que vale para todos.
CREATE OR REPLACE FUNCTION app_nome_escritorio_em_uso(nome text, exceto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM "organizacao" o
    WHERE o."ativa"
      AND app_chave_nome_escritorio(o."nome") = app_chave_nome_escritorio($1)
      AND o."id" IS DISTINCT FROM $2)
$fn$;
