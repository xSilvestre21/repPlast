-- O pagamento que atrasou: a indústria não pagou a comissão no mês em que
-- devia. Vale para o pedido inteiro e para cada parcela, com os mesmos campos.
--
--   comissaoNaoPaga     "ainda não foi pago", sem previsão
--   comissaoAdiadaPara  "AAAA-MM" em que a comissão conta, no lugar do mês dela
--
-- Nenhum pedido existente muda de mês: os dois nascem vazios.

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "comissaoNaoPaga" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comissaoAdiadaPara" CHAR(7);

-- AlterTable
ALTER TABLE "parcela_recebimento" ADD COLUMN     "comissaoNaoPaga" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comissaoAdiadaPara" CHAR(7);

-- O mês é "AAAA-MM", e é comparado como texto com a competência das consultas.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_comissao_adiada_valida"
  CHECK ("comissaoAdiadaPara" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "parcela_recebimento" ADD CONSTRAINT "parcela_comissao_adiada_valida"
  CHECK ("comissaoAdiadaPara" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Ou não se sabe quando a indústria paga, ou se sabe o mês — nunca os dois.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_nao_paga_sem_mes"
  CHECK (NOT ("comissaoNaoPaga" AND "comissaoAdiadaPara" IS NOT NULL));
ALTER TABLE "parcela_recebimento" ADD CONSTRAINT "parcela_nao_paga_sem_mes"
  CHECK (NOT ("comissaoNaoPaga" AND "comissaoAdiadaPara" IS NOT NULL));

-- "Não pago" e acerto lançado se contradizem: o acerto é a indústria pagando.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_nao_paga_sem_acerto"
  CHECK (NOT ("comissaoNaoPaga" AND "valorRecebido" IS NOT NULL));
ALTER TABLE "parcela_recebimento" ADD CONSTRAINT "parcela_nao_paga_sem_acerto"
  CHECK (NOT ("comissaoNaoPaga" AND "valorRecebido" IS NOT NULL));

-- A lista "pendentes de meses anteriores" procura por estes dois, e são raros.
CREATE INDEX "pedido_comissao_nao_paga_idx" ON "pedido"("organizacaoId") WHERE "comissaoNaoPaga";
CREATE INDEX "pedido_comissao_adiada_idx" ON "pedido"("organizacaoId", "comissaoAdiadaPara")
  WHERE "comissaoAdiadaPara" IS NOT NULL;
