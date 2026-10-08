-- ---------------------------------------------------------------------------
-- Um cliente, vários prepostos
-- ---------------------------------------------------------------------------

-- O cliente tinha UM dono (`cliente.representanteId`). Na prática a mesma
-- empresa é atendida por mais de um preposto, e nem todo pedido dela é
-- dividido com eles. Daqui em diante:
--
--   cliente_preposto  → quem ATENDE o cliente (vê, cota, lança pedido);
--   pedido.representanteId → com quem a comissão DAQUELE pedido é dividida
--                            (no máximo um; nenhum é do escritório).
--
-- A coluna antiga sai: dois lugares dizendo de quem é o cliente acabariam
-- discordando.

-- CreateTable
CREATE TABLE "cliente_preposto" (
    "clienteId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,

    CONSTRAINT "cliente_preposto_pkey" PRIMARY KEY ("clienteId","usuarioId")
);

-- CreateIndex
CREATE INDEX "cliente_preposto_usuarioId_idx" ON "cliente_preposto"("usuarioId");

-- AddForeignKey
ALTER TABLE "cliente_preposto" ADD CONSTRAINT "cliente_preposto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_preposto" ADD CONSTRAINT "cliente_preposto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN "criadoPorId" UUID;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O dono de hoje passa a ser o (único) preposto que atende — e, sem registro
-- melhor, quem cadastrou.
INSERT INTO "cliente_preposto" ("clienteId", "usuarioId")
SELECT "id", "representanteId" FROM "cliente" WHERE "representanteId" IS NOT NULL;

UPDATE "cliente" SET "criadoPorId" = "representanteId" WHERE "representanteId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Quem atende
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER pelo motivo de sempre (ver `app_ve_fornecedor`): a contagem
-- precisa ser a real, não a filtrada pelo RLS de `cliente_preposto`.
CREATE OR REPLACE FUNCTION app_atende_cliente(cliente_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM "cliente_preposto"
    WHERE "clienteId" = cliente_id AND "usuarioId" = app_usuario_id())
$fn$;

-- O produto de cliente segue quem atende o cliente. Produto sem cliente é
-- catálogo do escritório, visível a todos.
CREATE OR REPLACE FUNCTION app_ve_cliente(cliente_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT cliente_id IS NULL OR app_e_admin() OR app_atende_cliente(cliente_id)
$fn$;

-- Quem pode gravar um vínculo: o administrador, em qualquer cliente do
-- escritório; o preposto, só a si mesmo e só no cliente que ELE cadastrou —
-- é o que deixa o cadastro dele nascer na carteira dele. Sem a segunda
-- condição, um preposto se vincularia a qualquer cliente cujo id soubesse.
CREATE OR REPLACE FUNCTION app_pode_vincular_cliente(cliente_id uuid, usuario_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM "cliente" c
    WHERE c."id" = cliente_id
      AND c."organizacaoId" = app_organizacao_id()
      AND (app_e_admin()
           OR (usuario_id = app_usuario_id() AND c."criadoPorId" = app_usuario_id())))
  AND EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = usuario_id
      AND u."organizacaoId" = app_organizacao_id()
      AND u."papel" = 'REPRESENTANTE')
$fn$;

-- ---------------------------------------------------------------------------
-- Cliente
-- ---------------------------------------------------------------------------

-- Ler: quem atende, e — a exceção de sempre — o cliente de um pedido ou
-- orçamento que ele vê, para o documento não chegar sem nome.
DROP POLICY tenant_isolation ON "cliente";
CREATE POLICY tenant_isolation ON "cliente"
  FOR SELECT
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR app_atende_cliente("id")
         OR EXISTS (SELECT 1 FROM "pedido" p WHERE p."clienteId" = "cliente"."id")
         OR EXISTS (SELECT 1 FROM "orcamento" o WHERE o."clienteId" = "cliente"."id"))));

-- Alterar e excluir: só quem atende (a exceção de leitura não vale aqui).
DROP POLICY escrita_da_carteira ON "cliente";
CREATE POLICY escrita_de_quem_atende ON "cliente"
  FOR ALL
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR app_atende_cliente("id"))))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR app_atende_cliente("id"))));

-- Cadastrar: o cliente novo ainda não tem vínculo, e por isso a policy de
-- cima o recusaria. O preposto cadastra em nome próprio e em seguida se
-- vincula (`app_pode_vincular_cliente`).
CREATE POLICY cadastro ON "cliente"
  FOR INSERT
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "criadoPorId" = app_usuario_id())));

-- ---------------------------------------------------------------------------
-- O vínculo
-- ---------------------------------------------------------------------------

-- Ancorado no USUÁRIO, como `fornecedor_preposto`: ancorar no cliente faria a
-- policy dele consultar uma tabela cuja policy consulta o cliente de volta.
-- O preposto lê só os próprios vínculos; quem mais atende o cliente é
-- assunto do escritório. Alterar uma linha não existe: troca-se por outra.
ALTER TABLE "cliente_preposto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cliente_preposto" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cliente_preposto"
  FOR SELECT
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = "cliente_preposto"."usuarioId"
      AND u."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR u."id" = app_usuario_id())));
CREATE POLICY vinculo ON "cliente_preposto"
  FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_pode_vincular_cliente("clienteId", "usuarioId"));
CREATE POLICY desvinculo ON "cliente_preposto"
  FOR DELETE
  USING (app_bypass_rls() OR (app_e_admin() AND EXISTS (
    SELECT 1 FROM "usuario" u
    WHERE u."id" = "cliente_preposto"."usuarioId"
      AND u."organizacaoId" = app_organizacao_id())));

-- Só agora a coluna antiga pode sair: nada mais depende dela.
ALTER TABLE "cliente" DROP COLUMN "representanteId";
