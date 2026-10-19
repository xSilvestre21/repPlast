-- O dia em que a indústria fecha o faturamento, para quem só paga a comissão
-- no mês seguinte. Na indústria é a sugestão; no pedido, a regra das parcelas
-- dele. Nulo nas duas: o mês do vencimento, como sempre foi — nenhum pedido
-- existente muda de mês.

-- AlterTable
ALTER TABLE "fornecedor" ADD COLUMN     "diaFechamentoComissao" INTEGER;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "diaFechamentoComissao" INTEGER;

ALTER TABLE "fornecedor" ADD CONSTRAINT "fornecedor_dia_fechamento_valido"
  CHECK ("diaFechamentoComissao" BETWEEN 1 AND 31);
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_dia_fechamento_valido"
  CHECK ("diaFechamentoComissao" BETWEEN 1 AND 31);
