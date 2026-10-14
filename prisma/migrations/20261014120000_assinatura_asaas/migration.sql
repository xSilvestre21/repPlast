-- ---------------------------------------------------------------------------
-- Assinatura paga (Asaas)
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "Assinatura" AS ENUM ('AGUARDANDO_PAGAMENTO', 'ATIVA', 'ATRASADA', 'CANCELADA');

-- ATIVA por padrão: os escritórios de antes da cobrança continuam entrando.
-- AlterTable
ALTER TABLE "organizacao" ADD COLUMN     "asaasAssinaturaId" TEXT,
ADD COLUMN     "asaasCheckoutId" TEXT,
ADD COLUMN     "asaasClienteId" TEXT,
ADD COLUMN     "assinatura" "Assinatura" NOT NULL DEFAULT 'ATIVA',
ADD COLUMN     "cobrancaCep" TEXT,
ADD COLUMN     "cobrancaDocumento" TEXT;

-- CreateTable
CREATE TABLE "evento_asaas" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_asaas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacao_asaasCheckoutId_key" ON "organizacao"("asaasCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "organizacao_asaasAssinaturaId_key" ON "organizacao"("asaasAssinaturaId");

-- O registro de eventos é só do webhook, que roda como dono do banco. Para o
-- papel da aplicação a tabela existe (o GRANT padrão alcança tabela nova) mas
-- não devolve nem aceita linha nenhuma.
ALTER TABLE "evento_asaas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento_asaas" FORCE ROW LEVEL SECURITY;
CREATE POLICY so_administrativo ON "evento_asaas"
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());

-- O que é cobrado não se altera por tela: o plano e a situação da assinatura
-- só mudam pelo webhook (ou pelo dono do banco). Sem isto, um administrador
-- que montasse a requisição à mão poderia se marcar como pago. O RLS não
-- separa colunas, por isso o trigger — o mesmo jeito do contador da indústria.
CREATE OR REPLACE FUNCTION app_cobranca_so_administrativa() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF app_bypass_rls() THEN
    RETURN NEW;
  END IF;

  IF NEW."plano" IS DISTINCT FROM OLD."plano"
     OR NEW."assinatura" IS DISTINCT FROM OLD."assinatura"
     OR NEW."asaasCheckoutId" IS DISTINCT FROM OLD."asaasCheckoutId"
     OR NEW."asaasClienteId" IS DISTINCT FROM OLD."asaasClienteId"
     OR NEW."asaasAssinaturaId" IS DISTINCT FROM OLD."asaasAssinaturaId"
     OR NEW."cobrancaDocumento" IS DISTINCT FROM OLD."cobrancaDocumento"
     OR NEW."cobrancaCep" IS DISTINCT FROM OLD."cobrancaCep" THEN
    RAISE EXCEPTION 'O plano e a assinatura só mudam pela cobrança.';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER cobranca_so_administrativa
  BEFORE UPDATE ON "organizacao"
  FOR EACH ROW EXECUTE FUNCTION app_cobranca_so_administrativa();
