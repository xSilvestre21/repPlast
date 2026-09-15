-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "comissaoPercentualRecebido" DECIMAL(6,3),
ADD COLUMN     "entregueEm" DATE,
ADD COLUMN     "valorRecebido" DECIMAL(14,2);

-- O acerto vira dinheiro na mão do representante: valor e percentual negativos
-- não querem dizer nada, e o percentual acima de 100 é sempre erro de digitação.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_acerto_valores" CHECK (
  coalesce("valorRecebido", 0) >= 0
  AND coalesce("comissaoPercentualRecebido", 0) >= 0
  AND coalesce("comissaoPercentualRecebido", 0) <= 100
);
