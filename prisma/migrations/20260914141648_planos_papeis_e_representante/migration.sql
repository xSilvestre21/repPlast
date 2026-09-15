-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('PADRAO', 'PLUS');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'REPRESENTANTE');

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "representanteId" UUID;

-- AlterTable
ALTER TABLE "organizacao" ADD COLUMN     "plano" "Plano" NOT NULL DEFAULT 'PADRAO';

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "representanteId" UUID;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "papel" "Papel" NOT NULL DEFAULT 'ADMIN';

-- CreateIndex
CREATE INDEX "cliente_representanteId_idx" ON "cliente"("representanteId");

-- CreateIndex
CREATE INDEX "pedido_representanteId_idx" ON "pedido"("representanteId");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Segunda dimensão do isolamento: o preposto
--
-- Até aqui o RLS separava ESCRITÓRIO de escritório. Com o plano Plus ele passa
-- a separar também PREPOSTO de preposto dentro do mesmo escritório: cada um vê
-- a própria carteira, e o administrador vê tudo.
--
-- `representanteId` NULO quer dizer "é do escritório" — visível a todos. É o
-- que vale em todo escritório do plano PADRAO, onde não existe preposto, e é
-- por isso que ligar esta migration não muda nada para quem já usa o sistema.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_usuario_id() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid
$fn$;

-- Compara com 'ADMIN' em vez de "diferente de REPRESENTANTE" DE PROPÓSITO.
--
-- As duas formas só divergem quando o contexto não chegou — e é aí que está a
-- escolha: assim, a falha deixa o ADMIN vendo de menos, que aparece na hora.
-- A forma oposta deixaria o PREPOSTO vendo de mais, em silêncio.
CREATE OR REPLACE FUNCTION app_e_admin() RETURNS boolean
LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(current_setting('app.papel', true), '') = 'ADMIN'
$fn$;

-- Visível quando é do meu escritório E (sou admin, OU a linha é do escritório,
-- OU a linha é minha).
DROP POLICY tenant_isolation ON "cliente";
CREATE POLICY tenant_isolation ON "cliente"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())));

DROP POLICY tenant_isolation ON "pedido";
CREATE POLICY tenant_isolation ON "pedido"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())));

-- O item herda o dono do pedido. A condição é escrita por extenso em vez de
-- confiar no RLS do `pedido` avaliar-se sozinho dentro desta subconsulta: o
-- Postgres faz isso, mas depender disso deixaria a regra invisível para quem
-- ler esta policy amanhã.
DROP POLICY tenant_isolation ON "pedido_item";
CREATE POLICY tenant_isolation ON "pedido_item"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_item"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())));

-- O preposto não pode existir fora de um escritório Plus: é o que a assinatura
-- vende, e deixar a regra só na aplicação faria dela uma sugestão.
--
-- Trigger, e não CHECK, porque a regra olha OUTRA tabela — e CHECK no Postgres
-- não aceita subconsulta.
--
-- SECURITY DEFINER para que a checagem enxergue a organização mesmo quando o
-- RLS a esconderia do papel que está inserindo. Ela só faz um EXISTS; não
-- escreve, não recebe identificador de fora, e o search_path é fixado.
CREATE OR REPLACE FUNCTION usuario_exige_plus() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW."papel" = 'REPRESENTANTE' AND NOT EXISTS (
    SELECT 1 FROM "organizacao" o
    WHERE o."id" = NEW."organizacaoId" AND o."plano" = 'PLUS'
  ) THEN
    RAISE EXCEPTION 'Preposto exige o plano Plus.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER usuario_exige_plus
  BEFORE INSERT OR UPDATE OF "papel", "organizacaoId" ON "usuario"
  FOR EACH ROW EXECUTE FUNCTION usuario_exige_plus();
