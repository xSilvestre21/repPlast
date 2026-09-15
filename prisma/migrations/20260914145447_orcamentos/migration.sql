-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('ABERTO', 'ACEITO', 'RECUSADO', 'EXPIRADO');

-- AlterTable
ALTER TABLE "organizacao" ADD COLUMN     "observacoesPadrao" TEXT,
ADD COLUMN     "proximoNumeroOrcamento" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "orcamentoId" UUID;

-- CreateTable
CREATE TABLE "orcamento" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'ABERTO',
    "attn" TEXT,
    "validoAte" DATE,
    "prazoPagamento" TEXT,
    "observacoes" TEXT,
    "vendedor" TEXT,
    "ipiPercentual" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "subtotalSemIpi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorIpi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGeral" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "representanteId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_item" (
    "id" UUID NOT NULL,
    "orcamentoId" UUID NOT NULL,
    "produtoId" UUID,
    "ordem" INTEGER NOT NULL,
    "familia" "Familia" NOT NULL,
    "codigoFornecedor" TEXT,
    "codigoCliente" TEXT,
    "descricao" TEXT NOT NULL,
    "unidade" "UnidadeVenda" NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "comIpi" BOOLEAN NOT NULL DEFAULT true,
    "precoUnitario" DECIMAL(16,6) NOT NULL,
    "totalSemIpi" DECIMAL(14,2) NOT NULL,
    "valorIpi" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "pesoKg" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "orcamento_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orcamento_organizacaoId_idx" ON "orcamento"("organizacaoId");

-- CreateIndex
CREATE INDEX "orcamento_organizacaoId_status_idx" ON "orcamento"("organizacaoId", "status");

-- CreateIndex
CREATE INDEX "orcamento_clienteId_idx" ON "orcamento"("clienteId");

-- CreateIndex
CREATE INDEX "orcamento_representanteId_idx" ON "orcamento"("representanteId");

-- CreateIndex
CREATE UNIQUE INDEX "orcamento_organizacaoId_numero_key" ON "orcamento"("organizacaoId", "numero");

-- CreateIndex
CREATE INDEX "orcamento_item_orcamentoId_idx" ON "orcamento_item"("orcamentoId");

-- CreateIndex
CREATE INDEX "orcamento_item_produtoId_idx" ON "orcamento_item"("produtoId");

-- CreateIndex
CREATE INDEX "pedido_orcamentoId_idx" ON "pedido"("orcamentoId");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Isolamento do orçamento
--
-- Mesmo corte do pedido, nas duas dimensões: escritório e preposto. Sem isso a
-- proposta seria o furo por onde um preposto leria a carteira do colega.
-- ---------------------------------------------------------------------------

ALTER TABLE "orcamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orcamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orcamento"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "representanteId" IS NULL OR "representanteId" = app_usuario_id())));

ALTER TABLE "orcamento_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orcamento_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orcamento_item"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_item"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_item"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())));

-- O número é sequencial e começa em 1, como o do pedido.
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_numero_positivo" CHECK ("numero" > 0);
