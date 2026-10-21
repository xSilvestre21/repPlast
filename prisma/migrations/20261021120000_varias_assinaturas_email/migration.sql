-- Mais de uma assinatura por caixa de e-mail: a completa, a curta, a de cada
-- empresa. A que já existia vira a primeira — e a padrão — da sua caixa, com
-- o nome "Principal"; nenhum e-mail muda de assinatura com a troca.

-- CreateTable
CREATE TABLE "assinatura_email" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "contaId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinatura_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assinatura_email_contaId_idx" ON "assinatura_email"("contaId");

-- CreateIndex
CREATE INDEX "assinatura_email_organizacaoId_idx" ON "assinatura_email"("organizacaoId");

-- AddForeignKey
ALTER TABLE "assinatura_email" ADD CONSTRAINT "assinatura_email_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_email" ADD CONSTRAINT "assinatura_email_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_email" ADD CONSTRAINT "assinatura_email_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "conta_email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Só o dono, como a caixa de que ela faz parte (ver "conta_email").
ALTER TABLE "assinatura_email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assinatura_email" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assinatura_email"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "usuarioId" = app_usuario_id()));

-- A assinatura de antes, levada para a tabela nova.
INSERT INTO "assinatura_email" ("id", "organizacaoId", "usuarioId", "contaId", "nome", "html", "padrao", "atualizadoEm")
SELECT gen_random_uuid(), "organizacaoId", "usuarioId", "id", 'Principal', "assinaturaHtml", true, CURRENT_TIMESTAMP
FROM "conta_email"
WHERE "assinaturaHtml" IS NOT NULL;

-- AlterTable
ALTER TABLE "conta_email" DROP COLUMN "assinaturaHtml";
