-- O recebimento de um pedido pode ser parcelado.
--
-- O cliente paga "28/35/42", e a indústria paga a comissão conforme ele paga:
-- cada parte vence numa data — e às vezes num mês — diferente. O SICOV fazia
-- isso com registros filhos (`installmentIndex`, `dueDate`, `period`), que a
-- importação deixou de fora; esta tabela é o lugar deles.
--
-- Pedido sem parcela continua exatamente como antes.

CREATE TABLE "parcela_recebimento" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "valorRecebido" DECIMAL(14,2),
    "comissaoPercentualRecebido" DECIMAL(6,3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcela_recebimento_pkey" PRIMARY KEY ("id"),
    -- Parcela de valor zero ou negativo não é parcela: é erro de digitação
    -- que distorceria o mês em que cai.
    CONSTRAINT "parcela_recebimento_base_positiva" CHECK ("base" > 0)
);

CREATE UNIQUE INDEX "parcela_recebimento_pedidoId_numero_key" ON "parcela_recebimento"("pedidoId", "numero");
CREATE INDEX "parcela_recebimento_vencimento_idx" ON "parcela_recebimento"("vencimento");

ALTER TABLE "parcela_recebimento" ADD CONSTRAINT "parcela_recebimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mesmo corte de `envio_pedido`: pendurada no pedido, então quem não enxerga o
-- pedido não enxerga como ele vai ser pago.
ALTER TABLE "parcela_recebimento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcela_recebimento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "parcela_recebimento"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "parcela_recebimento"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())));
