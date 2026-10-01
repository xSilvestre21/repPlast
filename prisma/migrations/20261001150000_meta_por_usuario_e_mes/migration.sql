-- A meta de comissão deixa de ser um número só do escritório e passa a ser de
-- cada pessoa, mês a mês.
--
-- Por quê: a meta que faz sentido com a carteira de hoje não fazia com a de um
-- ano atrás, e um campo único reescrevia o passado a cada troca — o mês que
-- tinha sido batido deixava de ser. E o preposto via a meta do escritório
-- medida contra a fatia DELE, uma conta que não fecha.
--
-- Cada linha vale do mês dela em diante, até a próxima (ver o schema).

CREATE TABLE "meta_comissao" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "valor" DECIMAL(14,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_comissao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_comissao_usuarioId_competencia_key" ON "meta_comissao"("usuarioId", "competencia");
CREATE INDEX "meta_comissao_organizacaoId_idx" ON "meta_comissao"("organizacaoId");

ALTER TABLE "meta_comissao" ADD CONSTRAINT "meta_comissao_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_comissao" ADD CONSTRAINT "meta_comissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Só a dona, como a caixa de e-mail: a meta é o objetivo pessoal de cada um, e
-- nem o administrador lê ou troca a do preposto.
ALTER TABLE "meta_comissao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_comissao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meta_comissao"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()));

-- A meta que existia era do escritório e era comparada com a comissão DELE —
-- a leitura do administrador. Ela passa para cada administrador valendo a
-- partir do mês corrente, e não de antes: o passado nunca teve esse número
-- como meta, ele só aparecia lá porque o campo não tinha mês.
INSERT INTO "meta_comissao" ("id", "organizacaoId", "usuarioId", "competencia", "valor", "atualizadoEm")
SELECT gen_random_uuid(), u."organizacaoId", u."id", to_char(now(), 'YYYY-MM'), o."metaComissaoMensal", now()
FROM "usuario" u
JOIN "organizacao" o ON o."id" = u."organizacaoId"
WHERE u."papel" = 'ADMIN' AND o."metaComissaoMensal" IS NOT NULL;

ALTER TABLE "organizacao" DROP COLUMN "metaComissaoMensal";
