-- A proposta passa a ter dois tempos: montagem e leitura.
--
-- Nasce em elaboração — quem criou lança item e condição à vontade. O primeiro
-- "Salvar a proposta" a encerra, e dali em diante ela abre só para leitura;
-- mexer de novo exige clicar em editar, e cada gravada dessas vira log.
--
-- Tudo o que já existe entra como PRONTO: são propostas fechadas, importadas ou
-- feitas antes desta regra, e abri-las em modo de montagem diria que estão pela
-- metade quando não estão.
ALTER TABLE "orcamento" ADD COLUMN "emElaboracao" BOOLEAN NOT NULL DEFAULT true;

UPDATE "orcamento" SET "emElaboracao" = false;

-- ---------------------------------------------------------------------------
-- O log de edição
-- ---------------------------------------------------------------------------

CREATE TABLE "orcamento_edicao" (
    "id" UUID NOT NULL,
    "orcamentoId" UUID NOT NULL,
    "usuarioId" UUID,
    "editadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamento_edicao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orcamento_edicao_orcamentoId_editadoEm_idx" ON "orcamento_edicao"("orcamentoId", "editadoEm");

ALTER TABLE "orcamento_edicao" ADD CONSTRAINT "orcamento_edicao_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orcamento_edicao" ADD CONSTRAINT "orcamento_edicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo corte de `orcamento_item`: o log vive pendurado na proposta, então quem
-- não enxerga a proposta não enxerga o histórico dela.
ALTER TABLE "orcamento_edicao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orcamento_edicao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orcamento_edicao"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_edicao"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "orcamento" o
    WHERE o."id" = "orcamento_edicao"."orcamentoId"
      AND o."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR o."representanteId" IS NULL
           OR o."representanteId" = app_usuario_id())));
