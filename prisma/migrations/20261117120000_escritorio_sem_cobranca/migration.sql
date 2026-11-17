-- O escritório que usa o sistema sem pagar.
--
-- A conferência diária com o Asaas (`lib/conferencia-asaas.ts`) compara cada
-- escritório com a assinatura dele lá, e o escritório liberado sem assinatura
-- nenhuma vira alerta — é o uso de graça que ninguém decidiu. Quem tem esta
-- marca foi liberado de propósito, e a conferência o pula.
ALTER TABLE "organizacao" ADD COLUMN "semCobranca" BOOLEAN NOT NULL DEFAULT false;

-- O Val & Amaral não terá cobrança (decidido em 17/11/2026). Pelo nome, porque
-- o id muda de um banco para outro; onde o escritório não existe, não muda nada.
-- O dono do banco também passa pelo RLS forçado e pelo trigger da cobrança: o
-- escape das migrations, ligado só para este UPDATE.
SELECT set_config('app.bypass_rls', 'on', false);

UPDATE "organizacao" SET "semCobranca" = true WHERE lower(btrim("nome")) = 'val & amaral';

SELECT set_config('app.bypass_rls', 'off', false);

-- Dado de cobrança como os outros: só muda pelo caminho administrativo — senão
-- o escritório se marcaria como isento montando a requisição à mão.
CREATE OR REPLACE FUNCTION app_cobranca_so_administrativa() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF app_bypass_rls() THEN
    RETURN NEW;
  END IF;

  IF NEW."plano" IS DISTINCT FROM OLD."plano"
     OR NEW."assinatura" IS DISTINCT FROM OLD."assinatura"
     OR NEW."acessoAte" IS DISTINCT FROM OLD."acessoAte"
     OR NEW."testeAte" IS DISTINCT FROM OLD."testeAte"
     OR NEW."lembreteTesteEm" IS DISTINCT FROM OLD."lembreteTesteEm"
     OR NEW."semCobranca" IS DISTINCT FROM OLD."semCobranca"
     OR NEW."asaasCheckoutId" IS DISTINCT FROM OLD."asaasCheckoutId"
     OR NEW."asaasClienteId" IS DISTINCT FROM OLD."asaasClienteId"
     OR NEW."asaasAssinaturaId" IS DISTINCT FROM OLD."asaasAssinaturaId"
     OR NEW."cobrancaDocumento" IS DISTINCT FROM OLD."cobrancaDocumento"
     OR NEW."cobrancaCep" IS DISTINCT FROM OLD."cobrancaCep"
     OR NEW."cobrancaEndereco" IS DISTINCT FROM OLD."cobrancaEndereco"
     OR NEW."cobrancaNumero" IS DISTINCT FROM OLD."cobrancaNumero"
     OR NEW."cobrancaComplemento" IS DISTINCT FROM OLD."cobrancaComplemento"
     OR NEW."cobrancaBairro" IS DISTINCT FROM OLD."cobrancaBairro" THEN
    RAISE EXCEPTION 'O plano e a assinatura só mudam pela cobrança.';
  END IF;

  RETURN NEW;
END
$fn$;
