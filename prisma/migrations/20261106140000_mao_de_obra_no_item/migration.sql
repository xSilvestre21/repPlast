-- Com ou sem mão de obra se decide ao lançar o item, e não no cadastro: o produto
-- guarda só os dois valores, e cada pedido ou proposta escolhe qual cobrar.

ALTER TABLE "pedido_item" ADD COLUMN "acabamentoMaoDeObra" BOOLEAN;
ALTER TABLE "orcamento_item" ADD COLUMN "acabamentoMaoDeObra" BOOLEAN;

ALTER TABLE "produto" DROP CONSTRAINT "produto_acabamento_completo";
ALTER TABLE "produto" DROP COLUMN "acabamentoMaoDeObra";

-- Frasco ou bombona, com pelo menos um valor: é o que a linha vai poder cobrar.
ALTER TABLE "produto" ADD CONSTRAINT "produto_acabamento_completo" CHECK (
  CASE
    WHEN "acabamento" IS NULL THEN
      "acabamentoValorCom" IS NULL AND "acabamentoValorSem" IS NULL
    ELSE
      "familia" IN ('BOMBONA', 'FRASCO', 'FRASCO_TAMPA', 'BOMBONA_TAMPA')
      AND ("acabamentoValorCom" IS NOT NULL OR "acabamentoValorSem" IS NOT NULL)
  END
);
