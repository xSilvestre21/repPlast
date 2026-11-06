-- Os CHECKs das famílias vendidas por milheiro.
--
-- Todas guardam o preço em "precoAvulso", com a unidade em "unidadeAvulsa", e
-- exigem a medida que forma a descrição. O ELSE continua sendo stretch e bobina.

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
    ELSE
      "precoKg" IS NOT NULL
  END
);

ALTER TABLE "produto" DROP CONSTRAINT "produto_valores_nao_negativos";
ALTER TABLE "produto" ADD CONSTRAINT "produto_valores_nao_negativos" CHECK (
  coalesce("larguraCm", 0) >= 0 AND coalesce("comprimentoCm", 0) >= 0
  AND coalesce("espessuraMm", 0) >= 0 AND coalesce("fatorKg", 0) >= 0
  AND coalesce("densidade", 0) >= 0
  AND coalesce("precoUnidade", 0) >= 0 AND coalesce("precoCaixa", 0) >= 0
  AND coalesce("precoKg", 0) >= 0 AND coalesce("precoAvulso", 0) >= 0
  AND coalesce("capacidade", 0) >= 0 AND coalesce("alturaCm", 0) >= 0
  AND coalesce("diametroMm", 0) >= 0
);

ALTER TABLE "produto" ADD CONSTRAINT "produto_capacidade_unidade" CHECK (
  "capacidadeUnidade" IS NULL OR "capacidadeUnidade" IN ('L', 'mL')
);
