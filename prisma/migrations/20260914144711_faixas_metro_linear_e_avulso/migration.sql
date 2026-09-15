-- AlterEnum
ALTER TYPE "Familia" ADD VALUE 'AVULSO';

-- AlterEnum
ALTER TYPE "TipoAditivo" ADD VALUE 'POR_METRO_LINEAR';

-- AlterTable
ALTER TABLE "produto" ADD COLUMN     "precoAvulso" DECIMAL(14,4),
ADD COLUMN     "unidadeAvulsa" "UnidadeVenda";

-- CreateTable
CREATE TABLE "material_faixa" (
    "id" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "pesoDeKg" DECIMAL(12,3),
    "pesoAteKg" DECIMAL(12,3),
    "precoKg" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "material_faixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_faixa_materialId_idx" ON "material_faixa"("materialId");

-- AddForeignKey
ALTER TABLE "material_faixa" ADD CONSTRAINT "material_faixa_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Faixa de peso: isolamento e integridade
-- ---------------------------------------------------------------------------

-- Herda o escritório pelo material, que herda pela indústria. A permissão de
-- indústria entra junto: faixa de preço de indústria que o preposto não atende
-- é preço que ele não deveria ler.
ALTER TABLE "material_faixa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_faixa" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "material_faixa"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "material" m
    JOIN "fornecedor" f ON f."id" = m."fornecedorId"
    WHERE m."id" = "material_faixa"."materialId"
      AND f."organizacaoId" = app_organizacao_id()
      AND app_ve_fornecedor(f."id")))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "material" m
    JOIN "fornecedor" f ON f."id" = m."fornecedorId"
    WHERE m."id" = "material_faixa"."materialId"
      AND f."organizacaoId" = app_organizacao_id()
      AND app_ve_fornecedor(f."id")));

-- Preço e pesos negativos não querem dizer nada, e faixa invertida (de 500 até
-- 300) nunca casaria com peso nenhum — ficaria no cadastro sem nunca valer.
ALTER TABLE "material_faixa" ADD CONSTRAINT "material_faixa_valores" CHECK (
  "precoKg" >= 0
  AND coalesce("pesoDeKg", 0) >= 0
  AND coalesce("pesoAteKg", 0) >= 0
  AND ("pesoDeKg" IS NULL OR "pesoAteKg" IS NULL OR "pesoDeKg" <= "pesoAteKg")
);

-- ---------------------------------------------------------------------------
-- A família AVULSO entra no CHECK que guarda as demais
-- ---------------------------------------------------------------------------

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
);
