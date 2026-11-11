-- Os CHECKs das famílias novas.
--
-- Cada uma exige o preço, a unidade dele e a medida que forma a descrição. O
-- descartável é a exceção: a bandeja se pede pelo modelo, e a capacidade é
-- opcional. A pré-forma guarda o peso na coluna da capacidade, em gramas.

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
      AND "larguraCm" IS NOT NULL AND "metragemM" IS NOT NULL
    WHEN 'FITA_ARQUEAR' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL
    WHEN 'SELO_ARQUEAR' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL
    WHEN 'CANTONEIRA' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
      AND "larguraMm" IS NOT NULL AND "espessuraMm" IS NOT NULL
      AND "metragemM" IS NOT NULL
    WHEN 'DESCARTAVEL' THEN
      "precoAvulso" IS NOT NULL AND "unidadeAvulsa" IS NOT NULL
    ELSE
      "precoKg" IS NOT NULL
  END
);

-- O peso da pré-forma é em gramas.
ALTER TABLE "produto" DROP CONSTRAINT "produto_capacidade_unidade";
ALTER TABLE "produto" ADD CONSTRAINT "produto_capacidade_unidade" CHECK (
  "capacidadeUnidade" IS NULL OR "capacidadeUnidade" IN ('L', 'mL', 'g')
);

-- Pote e balde também têm conjunto com tampa.
ALTER TABLE "produto" DROP CONSTRAINT "produto_tampa_so_no_conjunto";
ALTER TABLE "produto" ADD CONSTRAINT "produto_tampa_so_no_conjunto" CHECK (
  "familia" IN ('FRASCO_TAMPA', 'BOMBONA_TAMPA', 'POTE_TAMPA', 'BALDE_TAMPA')
  OR ("fornecedorTampaId" IS NULL AND NOT "fornecedorTampaVariavel" AND "codigoTampa" IS NULL)
);

-- E acabamento, como frasco e bombona: pote rotulado em IML, balde serigrafado.
ALTER TABLE "produto" DROP CONSTRAINT "produto_acabamento_completo";
ALTER TABLE "produto" ADD CONSTRAINT "produto_acabamento_completo" CHECK (
  CASE
    WHEN "acabamento" IS NULL THEN
      "acabamentoValorCom" IS NULL AND "acabamentoValorSem" IS NULL
    ELSE
      "familia" IN (
        'BOMBONA', 'FRASCO', 'FRASCO_TAMPA', 'BOMBONA_TAMPA',
        'POTE', 'POTE_TAMPA', 'BALDE', 'BALDE_TAMPA'
      )
      AND ("acabamentoValorCom" IS NOT NULL OR "acabamentoValorSem" IS NOT NULL)
  END
);
