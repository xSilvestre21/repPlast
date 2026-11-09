-- Os 7 dias grátis.
--
-- O escritório que ganha o teste cadastra o cartão no checkout, e a primeira
-- cobrança vence 7 dias depois (`lib/teste-gratis.ts`). `testeAte` é a
-- meia-noite (de Brasília) desse dia: até lá o escritório está ATIVA sem ter
-- pagado nada, e cancelar não cobra. Nulo em quem pagou no dia.
--
-- `lembreteTesteEm` marca o e-mail de "o teste está acabando", para a rotina
-- diária não mandar duas vezes.
ALTER TABLE "organizacao" ADD COLUMN "testeAte" TIMESTAMP(3);
ALTER TABLE "organizacao" ADD COLUMN "lembreteTesteEm" TIMESTAMP(3);

-- O teste é um por CPF/CNPJ: o cadastro procura o documento nos outros escritórios.
CREATE INDEX "organizacao_cobrancaDocumento_idx" ON "organizacao"("cobrancaDocumento");

-- Dado de cobrança como os outros: só muda pelo caminho administrativo — senão
-- o escritório se daria um teste novo montando a requisição à mão.
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
