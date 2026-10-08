-- ---------------------------------------------------------------------------
-- Acertar comissão é só do administrador
-- ---------------------------------------------------------------------------

-- O preposto LÊ a comissão dele; quem lança o que a indústria pagou, a data de
-- entrega que decide a competência e as parcelas é o escritório. A tela já
-- esconde os botões e as ações exigem o administrador, mas o preposto pode
-- alterar o próprio pedido (é o que deixa ele editar o que lançou) — e uma
-- requisição montada à mão gravaria o acerto. O banco fecha a porta.

-- No pedido, só três colunas são de acerto, e o RLS não separa colunas: um
-- trigger recusa a mudança delas por quem não é administrador.
CREATE OR REPLACE FUNCTION app_acerto_so_do_admin() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF app_bypass_rls() OR app_e_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."valorRecebido" IS NOT NULL
       OR NEW."comissaoPercentualRecebido" IS NOT NULL
       OR NEW."entregueEm" IS NOT NULL THEN
      RAISE EXCEPTION 'Só o administrador lança o acerto da comissão.';
    END IF;
  ELSIF NEW."valorRecebido" IS DISTINCT FROM OLD."valorRecebido"
     OR NEW."comissaoPercentualRecebido" IS DISTINCT FROM OLD."comissaoPercentualRecebido"
     OR NEW."entregueEm" IS DISTINCT FROM OLD."entregueEm" THEN
    RAISE EXCEPTION 'Só o administrador lança o acerto da comissão.';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER acerto_so_do_admin
  BEFORE INSERT OR UPDATE ON "pedido"
  FOR EACH ROW EXECUTE FUNCTION app_acerto_so_do_admin();

-- As parcelas são inteiras de acerto: o preposto lê as do pedido que vê, e
-- só o administrador cria, altera ou apaga.
DROP POLICY tenant_isolation ON "parcela_recebimento";
CREATE POLICY tenant_isolation ON "parcela_recebimento"
  FOR SELECT
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())));
CREATE POLICY escrita_do_admin ON "parcela_recebimento"
  FOR ALL
  USING (app_bypass_rls() OR (app_e_admin() AND EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id())))
  WITH CHECK (app_bypass_rls() OR (app_e_admin() AND EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id())));
