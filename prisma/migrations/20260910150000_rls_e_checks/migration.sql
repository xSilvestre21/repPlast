-- Isolamento multi-tenant NO BANCO, e não apenas na aplicação.
--
-- A aplicação define `app.organizacao_id` no início de cada requisição
-- (ver src/lib/db.ts). As policies abaixo garantem que, mesmo se alguma query
-- esquecer o filtro, o Postgres simplesmente não devolve linha de outro
-- escritório. É a rede de segurança que torna seguro vender o sistema como SaaS.

-- ---------------------------------------------------------------------------
-- Funções de contexto
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_organizacao_id() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.organizacao_id', true), '')::uuid
$fn$;

-- Escape hatch para migrations, seed e rotinas administrativas. Nunca deve ser
-- ligado a partir de uma requisição de usuário.
CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
$fn$;

-- ---------------------------------------------------------------------------
-- A própria organização
-- ---------------------------------------------------------------------------

ALTER TABLE "organizacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizacao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "organizacao"
  USING (app_bypass_rls() OR "id" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "id" = app_organizacao_id());

-- ---------------------------------------------------------------------------
-- Tabelas que carregam organizacaoId diretamente
-- ---------------------------------------------------------------------------

ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "usuario"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

ALTER TABLE "cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cliente" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cliente"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

ALTER TABLE "fornecedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fornecedor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fornecedor"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

ALTER TABLE "produto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produto" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "produto"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

ALTER TABLE "pedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedido" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pedido"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

ALTER TABLE "comissao_apuracao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comissao_apuracao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "comissao_apuracao"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());

-- ---------------------------------------------------------------------------
-- Tabelas filhas — herdam o tenant pelo pai
-- ---------------------------------------------------------------------------

ALTER TABLE "faixa_comissao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faixa_comissao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "faixa_comissao"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "faixa_comissao"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "faixa_comissao"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()));

ALTER TABLE "aditivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aditivo" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aditivo"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "aditivo"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "aditivo"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()));

ALTER TABLE "produto_aditivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produto_aditivo" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "produto_aditivo"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "produto" p
    WHERE p."id" = "produto_aditivo"."produtoId"
      AND p."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "produto" p
    WHERE p."id" = "produto_aditivo"."produtoId"
      AND p."organizacaoId" = app_organizacao_id()));

ALTER TABLE "produto_codigo_cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produto_codigo_cliente" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "produto_codigo_cliente"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "produto" p
    WHERE p."id" = "produto_codigo_cliente"."produtoId"
      AND p."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "produto" p
    WHERE p."id" = "produto_codigo_cliente"."produtoId"
      AND p."organizacaoId" = app_organizacao_id()));

ALTER TABLE "pedido_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedido_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pedido_item"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()));

ALTER TABLE "comissao_lancamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comissao_lancamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "comissao_lancamento"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "comissao_apuracao" a
    WHERE a."id" = "comissao_lancamento"."apuracaoId"
      AND a."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "comissao_apuracao" a
    WHERE a."id" = "comissao_lancamento"."apuracaoId"
      AND a."organizacaoId" = app_organizacao_id()));

-- ---------------------------------------------------------------------------
-- Integridade das famílias de produto
--
-- O schema Prisma precisa das colunas anuláveis porque uma família não usa os
-- campos da outra. O banco é quem garante que cada família tenha o que precisa
-- para ser precificada.
-- ---------------------------------------------------------------------------

ALTER TABLE "produto" ADD CONSTRAINT "produto_campos_por_familia" CHECK (
  CASE "familia"
    WHEN 'SACO' THEN
      "larguraCm" IS NOT NULL AND "comprimentoCm" IS NOT NULL
      AND "espessuraMm" IS NOT NULL AND "fatorKg" IS NOT NULL
    WHEN 'FITA' THEN
      "precoUnidade" IS NOT NULL OR "precoCaixa" IS NOT NULL
    ELSE
      "precoKg" IS NOT NULL
  END
);

-- Medidas e preços não podem ser negativos.
ALTER TABLE "produto" ADD CONSTRAINT "produto_valores_nao_negativos" CHECK (
  coalesce("larguraCm", 0) >= 0 AND coalesce("comprimentoCm", 0) >= 0
  AND coalesce("espessuraMm", 0) >= 0 AND coalesce("fatorKg", 0) >= 0
  AND coalesce("precoUnidade", 0) >= 0 AND coalesce("precoCaixa", 0) >= 0
  AND coalesce("precoKg", 0) >= 0
);

-- O número do pedido é sequencial por fornecedor e começa em 1.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_numero_positivo" CHECK ("numero" > 0);
