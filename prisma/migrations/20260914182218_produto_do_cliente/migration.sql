-- AlterTable
ALTER TABLE "produto" ADD COLUMN     "clienteId" UUID,
ADD COLUMN     "unidadeRotulo" TEXT;

-- CreateIndex
CREATE INDEX "produto_clienteId_idx" ON "produto"("clienteId");

-- CreateIndex
CREATE INDEX "produto_organizacaoId_descricao_idx" ON "produto"("organizacaoId", "descricao");

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- O produto passa a herdar o dono do CLIENTE
-- ---------------------------------------------------------------------------
--
-- Até aqui o produto era do escritório e a única condição era a indústria.
-- Agora que ele tem cliente, um preposto não pode ver o produto de uma carteira
-- que não é dele: o preço do saco de um cliente é informação comercial daquele
-- cliente, e é justamente o que distingue as linhas que pareceriam repetidas.
--
-- SECURITY DEFINER pela mesma razão de `app_ve_fornecedor`: sem isso a
-- subconsulta rodaria sob a policy de `cliente`, o preposto não enxergaria a
-- linha do cliente alheio, e o `EXISTS` daria FALSO onde deveria dar falso —
-- mas um `NOT EXISTS` mal escrito daria VERDADEIRO e liberaria tudo. A função
-- fecha essa porta lendo a tabela sem policy e decidindo explicitamente.
--
-- `cliente_id IS NULL` é permissivo de propósito: produto sem dono é item de
-- catálogo do escritório, e some da tela de todo mundo se for tratado como
-- alheio.
CREATE OR REPLACE FUNCTION app_ve_cliente(cliente_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT cliente_id IS NULL
      OR app_e_admin()
      OR EXISTS (
           SELECT 1 FROM "cliente"
           WHERE "id" = cliente_id
             AND ("representanteId" IS NULL OR "representanteId" = app_usuario_id()))
$fn$;

DROP POLICY tenant_isolation ON "produto";
CREATE POLICY tenant_isolation ON "produto"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND app_ve_fornecedor("fornecedorId")
    AND app_ve_cliente("clienteId")))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND app_ve_fornecedor("fornecedorId")
    AND app_ve_cliente("clienteId")));
