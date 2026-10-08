-- ---------------------------------------------------------------------------
-- Cadastro é só do administrador
-- ---------------------------------------------------------------------------

-- Cliente, produto e indústria — com o que pendura em cada um: quem atende,
-- aditivos, materiais e faixas, contatos — quem cria, altera e exclui é o
-- escritório. O preposto CONSULTA o que vê, e lança pedido e proposta em cima.
-- A tela já esconde os botões e as ações exigem o administrador; o banco fecha
-- a porta para a requisição montada à mão, como no acerto da comissão.
--
-- RESTRICTIVE soma-se às policies que já existem (que continuam decidindo o
-- que cada um LÊ) em vez de afrouxá-las. Uma por comando: um RESTRICTIVE
-- `FOR ALL` restringiria a leitura também.
DO $do$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'cliente', 'cliente_preposto',
    'produto', 'produto_aditivo',
    'fornecedor_preposto', 'contato_fornecedor',
    'material', 'material_faixa', 'aditivo'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY cadastro_so_do_admin_insert ON %I AS RESTRICTIVE FOR INSERT
         WITH CHECK (app_bypass_rls() OR app_e_admin())', tabela);
    EXECUTE format(
      'CREATE POLICY cadastro_so_do_admin_update ON %I AS RESTRICTIVE FOR UPDATE
         USING (app_bypass_rls() OR app_e_admin())', tabela);
    EXECUTE format(
      'CREATE POLICY cadastro_so_do_admin_delete ON %I AS RESTRICTIVE FOR DELETE
         USING (app_bypass_rls() OR app_e_admin())', tabela);
  END LOOP;
END
$do$;

-- A indústria tem uma exceção, e por isso não entra na lista acima: o contador
-- de número de pedido mora nela, e é o preposto lançando (e apagando o último)
-- pedido que o move. Criar e excluir ficam com o administrador; alterar, o
-- preposto só altera o contador — um trigger compara a linha inteira menos ele,
-- porque o RLS não separa colunas.
CREATE POLICY cadastro_so_do_admin_insert ON "fornecedor" AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_e_admin());
CREATE POLICY cadastro_so_do_admin_delete ON "fornecedor" AS RESTRICTIVE FOR DELETE
  USING (app_bypass_rls() OR app_e_admin());

CREATE OR REPLACE FUNCTION app_fornecedor_so_do_admin() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF app_bypass_rls() OR app_e_admin() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'proximoNumeroPedido' - 'atualizadoEm')
     IS DISTINCT FROM (to_jsonb(OLD) - 'proximoNumeroPedido' - 'atualizadoEm') THEN
    RAISE EXCEPTION 'Só o administrador altera o cadastro da indústria.';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER fornecedor_so_do_admin
  BEFORE UPDATE ON "fornecedor"
  FOR EACH ROW EXECUTE FUNCTION app_fornecedor_so_do_admin();

-- O preposto não cadastra mais cliente, então também não se vincula ao que
-- cadastrou: o vínculo é só do administrador.
CREATE OR REPLACE FUNCTION app_pode_vincular_cliente(cliente_id uuid, usuario_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT app_e_admin()
  AND EXISTS (
    SELECT 1 FROM "cliente" c
    WHERE c."id" = cliente_id
      AND c."organizacaoId" = app_organizacao_id())
  AND EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = usuario_id
      AND u."organizacaoId" = app_organizacao_id()
      AND u."papel" = 'REPRESENTANTE')
$fn$;
