-- O pedido passa a ter os dois tempos do orçamento: montagem e leitura.
--
-- Nasce em elaboração — quem criou lança item e condição à vontade. O primeiro
-- "Salvar e voltar" a encerra, e dali em diante ele abre só para leitura;
-- mexer de novo exige clicar em Editar, e cada edição vira log.
--
-- Tudo o que já existe entra como PRONTO: são pedidos feitos antes desta regra,
-- e abri-los em modo de montagem diria que estão pela metade quando não estão.
ALTER TABLE "pedido" ADD COLUMN "emElaboracao" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "pedido" ADD COLUMN "edicoesConferidasEm" TIMESTAMP(3);

UPDATE "pedido" SET "emElaboracao" = false;

-- ---------------------------------------------------------------------------
-- O log de edição
-- ---------------------------------------------------------------------------

CREATE TABLE "pedido_edicao" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "usuarioId" UUID,
    "editadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_edicao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pedido_edicao_pedidoId_editadoEm_idx" ON "pedido_edicao"("pedidoId", "editadoEm");

ALTER TABLE "pedido_edicao" ADD CONSTRAINT "pedido_edicao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedido_edicao" ADD CONSTRAINT "pedido_edicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo corte de `envio_pedido`: o log vive pendurado no pedido, então quem
-- não enxerga o pedido não enxerga o histórico dele.
ALTER TABLE "pedido_edicao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedido_edicao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pedido_edicao"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_edicao"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "pedido_edicao"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())));
