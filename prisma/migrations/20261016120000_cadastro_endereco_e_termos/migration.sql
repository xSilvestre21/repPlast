-- O cadastro passa a pedir o endereço de quem paga e o aceite dos termos.

-- AlterTable
ALTER TABLE "organizacao" ADD COLUMN     "cobrancaEndereco" TEXT,
ADD COLUMN     "cobrancaNumero" TEXT;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "termosAceitosEm" TIMESTAMP(3),
ADD COLUMN     "termosVersao" TEXT;

-- O endereço de cobrança é dado de cobrança como o CPF/CNPJ e o CEP: só muda
-- pelo caminho administrativo, nunca pela tela com o papel da aplicação.
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
     OR NEW."cobrancaCep" IS DISTINCT FROM OLD."cobrancaCep"
     OR NEW."cobrancaEndereco" IS DISTINCT FROM OLD."cobrancaEndereco"
     OR NEW."cobrancaNumero" IS DISTINCT FROM OLD."cobrancaNumero" THEN
    RAISE EXCEPTION 'O plano e a assinatura só mudam pela cobrança.';
  END IF;

  RETURN NEW;
END
$fn$;
