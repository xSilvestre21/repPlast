-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "comissaoPercentualPreposto" DECIMAL(6,3);

-- Fatia fora de 0–100 não quer dizer nada, e o CHECK do acerto já guarda o
-- percentual do acerto pelo mesmo motivo.
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_percentual_preposto" CHECK (
  coalesce("comissaoPercentualPreposto", 0) >= 0
  AND coalesce("comissaoPercentualPreposto", 0) <= 100
);
