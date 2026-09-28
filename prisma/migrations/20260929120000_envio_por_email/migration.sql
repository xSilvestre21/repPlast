-- O pedido passa a sair por e-mail da caixa do PRÓPRIO representante, para
-- quem ele escolher.
--
-- Até aqui havia uma lista solta de endereços na indústria (`emailsPedido`),
-- um remetente do sistema e um botão que disparava para todos, sem escolha e
-- sem registro. Três tabelas substituem isso:
--
--   conta_email         a caixa de cada usuário (SMTP, senha cifrada)
--   contato_fornecedor  quem recebe na indústria, com nome e setor
--   envio_pedido        cada envio: de quem, para quem, com quais anexos

CREATE TYPE "ProvedorEmail" AS ENUM ('GMAIL', 'OUTLOOK', 'HOSTINGER', 'LOCAWEB', 'OUTRO');

-- ---------------------------------------------------------------------------
-- Contatos da indústria
-- ---------------------------------------------------------------------------

CREATE TABLE "contato_fornecedor" (
    "id" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "nome" TEXT,
    "setor" TEXT,
    "email" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contato_fornecedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contato_fornecedor_fornecedorId_email_key" ON "contato_fornecedor"("fornecedorId", "email");

ALTER TABLE "contato_fornecedor" ADD CONSTRAINT "contato_fornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já estava na lista recebia todo pedido: entra como padrão, na mesma
-- ordem. `DISTINCT ON` porque a lista antiga aceitava o mesmo endereço duas
-- vezes, e a tabela nova não.
INSERT INTO "contato_fornecedor" ("id", "fornecedorId", "email", "padrao", "ordem")
SELECT DISTINCT ON (f."id", lower(e.email))
       gen_random_uuid(), f."id", e.email, true, (e.ordem - 1)::int
FROM "fornecedor" f
CROSS JOIN LATERAL unnest(f."emailsPedido") WITH ORDINALITY AS e(email, ordem)
WHERE trim(e.email) <> ''
ORDER BY f."id", lower(e.email), e.ordem;

ALTER TABLE "fornecedor" DROP COLUMN "emailsPedido";

-- Segue a indústria, como aditivo e material: quem não vê a indústria não vê
-- quem trabalha nela.
ALTER TABLE "contato_fornecedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contato_fornecedor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contato_fornecedor"
  USING (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "contato_fornecedor"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())))
  WITH CHECK (app_bypass_rls() OR (app_ve_fornecedor("fornecedorId") AND EXISTS (
    SELECT 1 FROM "fornecedor" f
    WHERE f."id" = "contato_fornecedor"."fornecedorId"
      AND f."organizacaoId" = app_organizacao_id())));

-- ---------------------------------------------------------------------------
-- Caixa de e-mail do usuário
-- ---------------------------------------------------------------------------

CREATE TABLE "conta_email" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "provedor" "ProvedorEmail" NOT NULL,
    "email" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "porta" INTEGER NOT NULL,
    "tlsDireto" BOOLEAN NOT NULL,
    "usuarioSmtp" TEXT NOT NULL,
    "senhaCifrada" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "testadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conta_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conta_email_usuarioId_email_key" ON "conta_email"("usuarioId", "email");
CREATE INDEX "conta_email_organizacaoId_idx" ON "conta_email"("organizacaoId");

ALTER TABLE "conta_email" ADD CONSTRAINT "conta_email_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conta_email" ADD CONSTRAINT "conta_email_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Só o dono. Diferente do resto do schema, aqui o administrador NÃO enxerga
-- tudo: mandar e-mail pela caixa de um preposto é falar em nome dele, e a
-- senha dele não é do escritório.
ALTER TABLE "conta_email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conta_email" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conta_email"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()));

-- ---------------------------------------------------------------------------
-- Histórico de envios
-- ---------------------------------------------------------------------------

CREATE TABLE "envio_pedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "usuarioId" UUID,
    "de" TEXT NOT NULL,
    "para" TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "anexos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idMensagem" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_pedido_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "envio_pedido_pedidoId_enviadoEm_idx" ON "envio_pedido"("pedidoId", "enviadoEm");

ALTER TABLE "envio_pedido" ADD CONSTRAINT "envio_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_pedido" ADD CONSTRAINT "envio_pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo corte de `pedido_item`: pendurado no pedido.
ALTER TABLE "envio_pedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envio_pedido" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "envio_pedido"
  USING (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "envio_pedido"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR EXISTS (
    SELECT 1 FROM "pedido" pe
    WHERE pe."id" = "envio_pedido"."pedidoId"
      AND pe."organizacaoId" = app_organizacao_id()
      AND (app_e_admin() OR pe."representanteId" IS NULL
           OR pe."representanteId" = app_usuario_id())));
