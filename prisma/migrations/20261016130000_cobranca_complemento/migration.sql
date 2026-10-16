-- O complemento do endereço de cobrança ("Sala 3, bloco B"), opcional.

-- AlterTable
ALTER TABLE "organizacao" ADD COLUMN     "cobrancaComplemento" TEXT;

-- Dado de cobrança como os outros: só muda pelo caminho administrativo.
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
     OR NEW."cobrancaNumero" IS DISTINCT FROM OLD."cobrancaNumero"
     OR NEW."cobrancaComplemento" IS DISTINCT FROM OLD."cobrancaComplemento" THEN
    RAISE EXCEPTION 'O plano e a assinatura só mudam pela cobrança.';
  END IF;

  RETURN NEW;
END
$fn$;
