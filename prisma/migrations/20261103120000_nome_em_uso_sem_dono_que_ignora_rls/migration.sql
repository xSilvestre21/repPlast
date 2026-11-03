-- `app_nome_escritorio_em_uso` sem depender de o dono do banco ignorar o RLS.
--
-- A versão de 20261021130000 contava com isso: SECURITY DEFINER, ela roda como
-- o dono, e o dono ignora o RLS no Postgres local (superusuário) e no Neon
-- (BYPASSRLS). No banco gerenciado da AWS (Lightsail/RDS) o dono não é nem
-- uma coisa nem outra, e com FORCE ROW LEVEL SECURITY a função não via
-- escritório nenhum: respondia sempre "livre", e o nome repetido só era barrado
-- pelo índice, com a frase genérica.
--
-- Agora ela liga o `app.bypass_rls` só para a própria consulta e devolve o
-- valor de antes. O `set_config(..., true)` vale até o fim da TRANSAÇÃO, não
-- da função — sem a devolução, o bypass vazaria para o resto dela. (Fixar o
-- parâmetro na definição, `SET app.bypass_rls = 'on'`, faria a devolução
-- sozinho, mas exige superusuário: foi o que a migration de 21/10 tirou.)
--
-- Continua vendo todos os escritórios e devolvendo só sim ou não. `$1` e `$2`
-- em vez dos nomes: em plpgsql, `nome` colidiria com a coluna `o."nome"`.
CREATE OR REPLACE FUNCTION app_nome_escritorio_em_uso(nome text, exceto uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  anterior text := current_setting('app.bypass_rls', true);
  em_uso boolean;
BEGIN
  PERFORM set_config('app.bypass_rls', 'on', true);

  SELECT EXISTS (
    SELECT 1 FROM "organizacao" o
    WHERE o."ativa"
      AND app_chave_nome_escritorio(o."nome") = app_chave_nome_escritorio($1)
      AND o."id" IS DISTINCT FROM $2)
  INTO em_uso;

  PERFORM set_config('app.bypass_rls', coalesce(anterior, ''), true);
  RETURN em_uso;
END
$fn$;
