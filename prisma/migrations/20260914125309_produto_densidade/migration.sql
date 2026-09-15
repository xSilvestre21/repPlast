-- AlterTable
ALTER TABLE "produto" ADD COLUMN     "densidade" DECIMAL(10,4);

-- A densidade entra na fórmula do preço, então precisa da mesma guarda que as
-- outras medidas. Densidade negativa produziria preço negativo.
ALTER TABLE "produto" DROP CONSTRAINT "produto_valores_nao_negativos";
ALTER TABLE "produto" ADD CONSTRAINT "produto_valores_nao_negativos" CHECK (
  coalesce("larguraCm", 0) >= 0 AND coalesce("comprimentoCm", 0) >= 0
  AND coalesce("espessuraMm", 0) >= 0 AND coalesce("fatorKg", 0) >= 0
  AND coalesce("densidade", 0) >= 0
  AND coalesce("precoUnidade", 0) >= 0 AND coalesce("precoCaixa", 0) >= 0
  AND coalesce("precoKg", 0) >= 0
);
