-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "comissaoPercentualPadrao" DECIMAL(6,3);

-- CreateTable
CREATE TABLE "fornecedor_preposto" (
    "fornecedorId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,

    CONSTRAINT "fornecedor_preposto_pkey" PRIMARY KEY ("fornecedorId","usuarioId")
);

-- CreateIndex
CREATE INDEX "fornecedor_preposto_usuarioId_idx" ON "fornecedor_preposto"("usuarioId");

-- AddForeignKey
ALTER TABLE "fornecedor_preposto" ADD CONSTRAINT "fornecedor_preposto_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_preposto" ADD CONSTRAINT "fornecedor_preposto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Quais indústrias o preposto enxerga
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER não é conforto: é o que impede a regra de falhar ABERTA.
--
-- Sem ele, a subconsulta abaixo passaria pelo RLS de `fornecedor_preposto`. Um
-- preposto que não enxergasse as próprias linhas de permissão faria o
-- `NOT EXISTS` dar verdadeiro — e a leitura "indústria sem permissão cadastrada
-- é de todos" liberaria TODAS as indústrias para ele. Rodando como dono, a
-- contagem é sempre a real.
--
-- A função só conta linhas; não escreve, não recebe identificador de fora e o
-- search_path é fixado.
CREATE OR REPLACE FUNCTION app_ve_fornecedor(fornecedor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT app_e_admin()
      OR NOT EXISTS (
           SELECT 1 FROM "fornecedor_preposto" WHERE "fornecedorId" = fornecedor_id)
      OR EXISTS (
           SELECT 1 FROM "fornecedor_preposto"
           WHERE "fornecedorId" = fornecedor_id AND "usuarioId" = app_usuario_id())
$fn$;

-- A tabela de permissão se ancora no USUÁRIO, e não no fornecedor: ancorá-la no
-- fornecedor faria a policy do fornecedor consultar uma tabela cuja policy
-- consulta o fornecedor de volta.
ALTER TABLE "fornecedor_preposto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fornecedor_preposto" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fornecedor_preposto"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = "fornecedor_preposto"."usuarioId"
      AND u."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = "fornecedor_preposto"."usuarioId"
      AND u."organizacaoId" = app_organizacao_id()));

DROP POLICY tenant_isolation ON "fornecedor";
CREATE POLICY tenant_isolation ON "fornecedor"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("id")))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("id")));

-- Produto, material e aditivo seguem a indústria. A condição é repetida por
-- extenso em cada uma em vez de ficar só no `fornecedor`: o Postgres aplicaria
-- a policy do fornecedor dentro destas subconsultas de qualquer forma, mas a
-- regra ficaria invisível para quem abrir este arquivo amanhã.
DROP POLICY tenant_isolation ON "produto";
CREATE POLICY tenant_isolation ON "produto"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("fornecedorId")))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("fornecedorId")));

DROP POLICY tenant_isolation ON "material";
CREATE POLICY tenant_isolation ON "material"
  USING (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "material"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())))
  WITH CHECK (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "material"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())));

DROP POLICY tenant_isolation ON "aditivo";
CREATE POLICY tenant_isolation ON "aditivo"
  USING (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "aditivo"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())))
  WITH CHECK (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "aditivo"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())));
