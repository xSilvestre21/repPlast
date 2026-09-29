-- A proposta passa a sair por e-mail, como o pedido — mas para o CLIENTE.
--
-- Cada usuário ganha o próprio texto padrão para ela (quem envia assina), e
-- cada envio vira linha em `envio_orcamento`, espelho de `envio_pedido`.
ALTER TABLE "usuario" ADD COLUMN "assuntoOrcamentoPadrao" TEXT;
ALTER TABLE "usuario" ADD COLUMN "mensagemOrcamentoPadrao" TEXT;

CREATE TABLE "envio_orcamento" (
    "id" UUID NOT NULL,
    "orcamentoId" UUID NOT NULL,
    "usuarioId" UUID,
    "de" TEXT NOT NULL,
    "para" TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "anexos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idMensagem" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_orcamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "envio_orcamento_orcamentoId_enviadoEm_idx" ON "envio_orcamento"("orcamentoId", "enviadoEm");

ALTER TABLE "envio_orcamento" ADD CONSTRAINT "envio_orcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_orcamento" ADD CONSTRAINT "envio_orcamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo corte de `orcamento_edicao`: pendurado na proposta, então quem não
-- enxerga a proposta não enxerga para quem ela foi.
ALTER TABLE "envio_orcamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envio_orcamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "envio_orcamento"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "envio_orcamento"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "envio_orcamento"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())));
