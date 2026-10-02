-- O escritório passa a registrar o que pagou a cada preposto.
--
-- O que ele DEVE continua derivado dos pedidos (a fatia do preposto no que a
-- indústria já acertou); esta tabela guarda só os pagamentos, para a tela de
-- comissões mostrar o saldo a repassar de um mês para o outro.

CREATE TABLE "repasse_preposto" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "prepostoId" UUID NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "pagoEm" DATE NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repasse_preposto_pkey" PRIMARY KEY ("id"),
    -- Pagamento zero ou negativo é erro de digitação; desfazer um lançamento é
    -- excluí-lo, não lançar outro ao contrário.
    CONSTRAINT "repasse_preposto_valor_positivo" CHECK ("valor" > 0)
);

CREATE INDEX "repasse_preposto_organizacaoId_idx" ON "repasse_preposto"("organizacaoId");
CREATE INDEX "repasse_preposto_prepostoId_competencia_idx" ON "repasse_preposto"("prepostoId", "competencia");

ALTER TABLE "repasse_preposto" ADD CONSTRAINT "repasse_preposto_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repasse_preposto" ADD CONSTRAINT "repasse_preposto_prepostoId_fkey" FOREIGN KEY ("prepostoId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O administrador vê e lança tudo do escritório; o preposto só LÊ os próprios.
-- A escrita exige admin mesmo para a linha do próprio preposto: quem paga é o
-- escritório, e um preposto lançando "recebi" apagaria a própria dívida.
--
-- Duas policies, e não uma: o DELETE e o UPDATE filtram pelo `USING`, então
-- uma policy só com "admin OU o próprio" deixaria o preposto apagar o próprio
-- repasse — o `WITH CHECK` só olha a linha que entra, e o DELETE não tem uma.
ALTER TABLE "repasse_preposto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repasse_preposto" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "repasse_preposto"
  FOR SELECT
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "prepostoId" = app_usuario_id())));
CREATE POLICY escrita_do_administrador ON "repasse_preposto"
  FOR ALL
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_e_admin()))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_e_admin()));
