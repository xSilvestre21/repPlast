-- Até quando o escritório que cancelou continua entrando.
--
-- Os Termos prometem: cancelada a assinatura, "o acesso continua até o fim do
-- mês já pago". O cancelamento pela tela (Configurações) grava aqui o próximo
-- vencimento, e a sessão deixa entrar o escritório CANCELADA até essa data
-- (`lib/acesso-assinatura.ts`). Nulo em todos os outros casos — inclusive no
-- cancelamento pelo painel do Asaas, que corta na hora, como antes.
ALTER TABLE "organizacao" ADD COLUMN "acessoAte" TIMESTAMP(3);

-- Dado de cobrança como os outros: só muda pelo caminho administrativo — senão
-- o escritório se daria mais um ano de acesso montando a requisição à mão.
CREATE OR REPLACE FUNCTION app_cobranca_so_administrativa() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF app_bypass_rls() THEN
    RETURN NEW;
  END IF;

  IF NEW."plano" IS DISTINCT FROM OLD."plano"
     OR NEW."assinatura" IS DISTINCT FROM OLD."assinatura"
     OR NEW."acessoAte" IS DISTINCT FROM OLD."acessoAte"
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
