-- O fornecedor da tampa dos conjuntos e o acabamento de frascos e bombonas.

-- AlterTable
ALTER TABLE "produto" ADD COLUMN "fornecedorTampaId" UUID;
ALTER TABLE "produto" ADD COLUMN "fornecedorTampaVariavel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "produto" ADD COLUMN "codigoTampa" TEXT;
ALTER TABLE "produto" ADD COLUMN "acabamento" TEXT;
ALTER TABLE "produto" ADD COLUMN "acabamentoMaoDeObra" BOOLEAN;
ALTER TABLE "produto" ADD COLUMN "acabamentoValorCom" DECIMAL(14,4);
ALTER TABLE "produto" ADD COLUMN "acabamentoValorSem" DECIMAL(14,4);

ALTER TABLE "pedido_item" ADD COLUMN "fornecedorTampaId" UUID;
ALTER TABLE "pedido_item" ADD COLUMN "fornecedorTampaNome" TEXT;
ALTER TABLE "pedido_item" ADD COLUMN "codigoTampa" TEXT;

ALTER TABLE "orcamento_item" ADD COLUMN "fornecedorTampaId" UUID;
ALTER TABLE "orcamento_item" ADD COLUMN "fornecedorTampaNome" TEXT;
ALTER TABLE "orcamento_item" ADD COLUMN "codigoTampa" TEXT;

-- CreateIndex
CREATE INDEX "produto_fornecedorTampaId_idx" ON "produto"("fornecedorTampaId");
CREATE INDEX "pedido_item_fornecedorTampaId_idx" ON "pedido_item"("fornecedorTampaId");
CREATE INDEX "orcamento_item_fornecedorTampaId_idx" ON "orcamento_item"("fornecedorTampaId");

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_fornecedorTampaId_fkey"
  FOREIGN KEY ("fornecedorTampaId") REFERENCES "fornecedor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_fornecedorTampaId_fkey"
  FOREIGN KEY ("fornecedorTampaId") REFERENCES "fornecedor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_fornecedorTampaId_fkey"
  FOREIGN KEY ("fornecedorTampaId") REFERENCES "fornecedor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Fornecedor e código de tampa só existem nos conjuntos, e o fornecedor variável
-- não tem fornecedor fixo: quem diz qual é o item do pedido ou da proposta.
ALTER TABLE "produto" ADD CONSTRAINT "produto_tampa_so_no_conjunto" CHECK (
  "familia" IN ('FRASCO_TAMPA', 'BOMBONA_TAMPA')
  OR ("fornecedorTampaId" IS NULL AND NOT "fornecedorTampaVariavel" AND "codigoTampa" IS NULL)
);
ALTER TABLE "produto" ADD CONSTRAINT "produto_tampa_variavel_sem_fixo" CHECK (
  NOT "fornecedorTampaVariavel" OR "fornecedorTampaId" IS NULL
);

-- Acabamento é de frasco e bombona, e o valor marcado é o que entra no preço.
ALTER TABLE "produto" ADD CONSTRAINT "produto_acabamento_completo" CHECK (
  CASE
    WHEN "acabamento" IS NULL THEN
      "acabamentoMaoDeObra" IS NULL
      AND "acabamentoValorCom" IS NULL AND "acabamentoValorSem" IS NULL
    ELSE
      "familia" IN ('BOMBONA', 'FRASCO', 'FRASCO_TAMPA', 'BOMBONA_TAMPA')
      AND CASE "acabamentoMaoDeObra"
        WHEN true THEN "acabamentoValorCom" IS NOT NULL
        WHEN false THEN "acabamentoValorSem" IS NOT NULL
        ELSE false
      END
  END
);
ALTER TABLE "produto" ADD CONSTRAINT "produto_acabamento_nao_negativo" CHECK (
  coalesce("acabamentoValorCom", 0) >= 0 AND coalesce("acabamentoValorSem", 0) >= 0
);

-- O preposto lê o NOME da indústria que fornece a tampa de um produto que ele
-- vê, pelo mesmo motivo de `industria_dos_pedidos_visiveis`: sem isso, a ficha e
-- o lançamento do item chegariam sem o nome. A subconsulta roda como ele, sob o
-- RLS do produto, e o catálogo dela continua preso a `app_ve_fornecedor`.
DROP POLICY tenant_isolation ON "fornecedor";
CREATE POLICY tenant_isolation ON "fornecedor"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND (
      app_ve_fornecedor("id")
      OR EXISTS (SELECT 1 FROM "pedido" p WHERE p."fornecedorId" = "fornecedor"."id")
      OR EXISTS (SELECT 1 FROM "orcamento" o WHERE o."fornecedorId" = "fornecedor"."id")
      OR EXISTS (SELECT 1 FROM "produto" t WHERE t."fornecedorTampaId" = "fornecedor"."id"))))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("id")));
