-- CreateTable
CREATE TABLE "material" (
    "id" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "precoKg" DECIMAL(12,4) NOT NULL,
    "densidade" DECIMAL(10,4),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_fornecedorId_idx" ON "material"("fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "material_fornecedorId_nome_key" ON "material"("fornecedorId", "nome");

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Isolamento multi-tenant
--
-- Tabela filha: herda o escritório pelo fornecedor, igual a `aditivo`. Sem
-- isto a tabela nasceria como o ÚNICO ponto do schema sem policy — e o RLS
-- protege por tabela, não por banco.
-- ---------------------------------------------------------------------------

ALTER TABLE "material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "material"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "material"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "material"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id()));

-- Preço e densidade não podem ser negativos — mesma guarda que `produto` tem.
ALTER TABLE "material" ADD CONSTRAINT "material_valores_nao_negativos" CHECK (
  "precoKg" >= 0 AND coalesce("densidade", 0) >= 0
);
