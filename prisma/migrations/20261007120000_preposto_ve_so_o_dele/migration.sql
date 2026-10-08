-- ---------------------------------------------------------------------------
-- O preposto vê só o que é dele
-- ---------------------------------------------------------------------------

-- Até aqui o preposto via o que era dele E o que era do escritório (linha com
-- `representanteId` nulo) — na prática, toda a base importada do SICOV. Agora:
--
--   cliente    → só os da carteira dele;
--   orçamento  → só os que ele DIGITOU;
--   pedido     → os que ele digitou e os que lhe pagam comissão.
--
-- "Quem digitou" não existia: `representanteId` é de quem é a carteira (e a
-- comissão), e o escritório lança pedido para a carteira do preposto o tempo
-- todo. Nasce `criadoPorId`. NULO é do escritório, e só o administrador vê.

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN "criadoPorId" UUID;
ALTER TABLE "orcamento" ADD COLUMN "criadoPorId" UUID;

-- CreateIndex
CREATE INDEX "pedido_criadoPorId_idx" ON "pedido"("criadoPorId");
CREATE INDEX "orcamento_criadoPorId_idx" ON "orcamento"("criadoPorId");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O histórico não registrou quem criou cada documento — só quem editou. O
-- melhor palpite é o preposto da carteira; sem preposto, fica do escritório.
UPDATE "pedido" SET "criadoPorId" = "representanteId" WHERE "representanteId" IS NOT NULL;
UPDATE "orcamento" SET "criadoPorId" = "representanteId" WHERE "representanteId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pedido: o que ele digitou e o que lhe paga comissão
-- ---------------------------------------------------------------------------

-- O que paga entra porque a comissão é dele: escondê-lo tiraria a venda da
-- tela de Comissões e da ficha, e ele receberia por algo que não vê.
DROP POLICY tenant_isolation ON "pedido";
CREATE POLICY tenant_isolation ON "pedido"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "criadoPorId" = app_usuario_id()
         OR "representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "criadoPorId" = app_usuario_id()
         OR "representanteId" = app_usuario_id())));

-- As filhas repetem a condição por extenso, como as policies que substituem.

DROP POLICY tenant_isolation ON "pedido_item";
CREATE POLICY tenant_isolation ON "pedido_item"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "pedido_edicao";
CREATE POLICY tenant_isolation ON "pedido_edicao"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_edicao"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_edicao"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "envio_pedido";
CREATE POLICY tenant_isolation ON "envio_pedido"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "envio_pedido"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "envio_pedido"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "parcela_recebimento";
CREATE POLICY tenant_isolation ON "parcela_recebimento"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."criadoPorId" = app_usuario_id()
           OR pe."representanteId" = app_usuario_id())));

-- ---------------------------------------------------------------------------
-- Orçamento: só o que ele digitou
-- ---------------------------------------------------------------------------

-- A proposta que o escritório monta para um cliente dele NÃO aparece para ele.
-- Se virar pedido, o pedido sim — é dele a comissão (ver acima).
DROP POLICY tenant_isolation ON "orcamento";
CREATE POLICY tenant_isolation ON "orcamento"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "criadoPorId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "criadoPorId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "orcamento_item";
CREATE POLICY tenant_isolation ON "orcamento_item"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_item"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_item"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "orcamento_edicao";
CREATE POLICY tenant_isolation ON "orcamento_edicao"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_edicao"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_edicao"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "envio_orcamento";
CREATE POLICY tenant_isolation ON "envio_orcamento"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "envio_orcamento"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "envio_orcamento"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."criadoPorId" = app_usuario_id())));

-- Ninguém cria documento em nome de outro: o preposto só grava a si mesmo como
-- autor. RESTRICTIVE soma-se às outras policies em vez de afrouxá-las.
CREATE POLICY autor_e_quem_cria ON "pedido" AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_e_admin() OR "criadoPorId" = app_usuario_id());

CREATE POLICY autor_e_quem_cria ON "orcamento" AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_e_admin() OR "criadoPorId" = app_usuario_id());

-- ---------------------------------------------------------------------------
-- Cliente: só a carteira dele
-- ---------------------------------------------------------------------------

-- Uma exceção de LEITURA, a mesma da indústria: o cliente de um pedido ou
-- orçamento que ele vê continua legível. Sem ela, o pedido que ele digitou
-- para um cliente que depois mudou de carteira chegaria sem cliente, e toda
-- tela que mostra o nome dele quebraria. As subconsultas rodam como ele, sob
-- o RLS do pedido e do orçamento.
--
-- Leitura e escrita em policies separadas, como no `compromisso`: a escrita
-- não pode herdar a exceção. Com uma policy só, o preposto poderia ALTERAR um
-- cliente que só lê pela exceção — e o cadastro grava `representanteId = ele`
-- ao salvar, então editar seria tomar a carteira do colega.
DROP POLICY tenant_isolation ON "cliente";
CREATE POLICY tenant_isolation ON "cliente"
  FOR SELECT
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" = app_usuario_id()
         OR EXISTS (SELECT 1 FROM "pedido" p WHERE p."clienteId" = "cliente"."id")
         OR EXISTS (SELECT 1 FROM "orcamento" o WHERE o."clienteId" = "cliente"."id"))));
CREATE POLICY escrita_da_carteira ON "cliente"
  FOR ALL
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" = app_usuario_id())));

-- O produto de cliente segue a carteira — sem a exceção de leitura acima: o
-- preço daquele cliente é informação comercial de quem tem a carteira.
-- Produto sem cliente continua sendo catálogo do escritório, visível a todos.
CREATE OR REPLACE FUNCTION app_ve_cliente(cliente_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT cliente_id IS NULL
      OR app_e_admin()
      OR EXISTS (
           SELECT 1 FROM "cliente"
           WHERE "id" = cliente_id AND "representanteId" = app_usuario_id())
$fn$;
