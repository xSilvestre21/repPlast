-- Os dados para pagamento da indústria em campos (PIX, banco, agência, conta,
-- favorecido), no lugar da caixa de texto única de `dadosPagamento`.
--
-- O texto livre que já existir não se perde: vira `pagamentoObservacoes`, o
-- campo do que não cabe nos outros. O RLS e o `fornecedor_so_do_admin` valem
-- para as colunas novas como para as outras.

ALTER TABLE "fornecedor" RENAME COLUMN "dadosPagamento" TO "pagamentoObservacoes";

ALTER TABLE "fornecedor"
  ADD COLUMN "pagamentoTipoChavePix" TEXT,
  ADD COLUMN "pagamentoChavePix" TEXT,
  ADD COLUMN "pagamentoBanco" TEXT,
  ADD COLUMN "pagamentoAgencia" TEXT,
  ADD COLUMN "pagamentoConta" TEXT,
  ADD COLUMN "pagamentoTipoConta" TEXT,
  ADD COLUMN "pagamentoFavorecido" TEXT,
  ADD COLUMN "pagamentoDocumento" TEXT;
