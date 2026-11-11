-- Plástico bolha e cantoneira escritos como o mercado escreve.
--
-- O bolha se pede pela largura em metros ("1,30 x 100m"), e a cantoneira toda em
-- mm, comprimento inclusive ("50x50x5x1200mm"). Cada medida ganha a sua coluna,
-- na unidade em que se digita: converter metro para centímetro na ida e na volta
-- seria um lugar a mais para errar.

-- AlterTable
ALTER TABLE "produto" ADD COLUMN "larguraM" DECIMAL(10,3);
ALTER TABLE "produto" ADD COLUMN "comprimentoMm" DECIMAL(10,2);

ALTER TABLE "produto" DROP CONSTRAINT "produto_valores_nao_negativos";
ALTER TABLE "produto" ADD CONSTRAINT "produto_valores_nao_negativos" CHECK (
  coalesce("larguraCm", 0) >= 0 AND coalesce("comprimentoCm", 0) >= 0
  AND coalesce("espessuraMm", 0) >= 0 AND coalesce("fatorKg", 0) >= 0
  AND coalesce("densidade", 0) >= 0
  AND coalesce("precoUnidade", 0) >= 0 AND coalesce("precoCaixa", 0) >= 0
  AND coalesce("precoKg", 0) >= 0 AND coalesce("precoAvulso", 0) >= 0
  AND coalesce("capacidade", 0) >= 0 AND coalesce("alturaCm", 0) >= 0
  AND coalesce("diametroMm", 0) >= 0
  AND coalesce("larguraM", 0) >= 0 AND coalesce("comprimentoMm", 0) >= 0
);

ALTER TABLE "produto" DROP CONSTRAINT "produto_campos_por_familia";
ALTER TABLE "produto" ADD CONSTRAINT "produto_campos_por_familia" CHECK (
  CASE "familia"
    WHEN 'SACO' THEN
      "larguraCm" IS NOT NULL AND "comprimentoCm" IS NOT NULL
      AND "espessuraMm" IS NOT NULL AND "fatorKg" IS NOT NULL
    WHEN 'FITA' THEN
      "precoUnidade" IS NOT NULL OR "precoCaixa" IS NOT NULL
    WHEN 'AVULSO' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
    WHEN 'BOMBONA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
    WHEN 'FRASCO' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
    WHEN 'PAPELAO' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "comprimentoCm" IS NOT NULL AND "larguraCm" IS NOT NULL
    WHEN 'TAMPA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'FRASCO_TAMPA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'BOMBONA_TAMPA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'BATOQUE' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'ALCA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'POTE' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
    WHEN 'POTE_TAMPA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'BALDE' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
    WHEN 'BALDE_TAMPA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'GATILHO' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'VALVULA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "diametroMm" IS NOT NULL
    WHEN 'PREFORMA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "capacidade" IS NOT NULL AND "capacidadeUnidade" IS NOT NULL
    WHEN 'RAFIA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraCm" IS NOT NULL AND "comprimentoCm" IS NOT NULL
    WHEN 'BIG_BAG' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "comprimentoCm" IS NOT NULL AND "larguraCm" IS NOT NULL
    WHEN 'BOLHA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraM" IS NOT NULL AND "metragemM" IS NOT NULL
    WHEN 'FITA_ARQUEAR' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL
    WHEN 'SELO_ARQUEAR' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL
    WHEN 'CANTONEIRA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL AND "espessuraMm" IS NOT NULL
      AND "comprimentoMm" IS NOT NULL
    WHEN 'DESCARTAVEL' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
    ELSE
      "precoKg" IS NOT NULL
  END
);
