-- O CHECK das famílias, agora com batoque e alça: os dois exigem o que a tampa
-- exige — preço do milheiro e o diâmetro, que neles é o do gargalo.

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
    ELSE
      "precoKg" IS NOT NULL
  END
);
