-- "Esqueceu sua senha?" e o limite de tentativas de login.
--
-- `sessaoVersao` vai dentro do token da sessão: redefinir a senha soma 1 e
-- derruba toda sessão aberta antes. As duas tabelas novas acontecem ANTES de
-- haver escritório na requisição — como o próprio login —, e por isso não têm
-- escopo de escritório: só o cliente administrativo as lê e escreve.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "sessaoVersao" INTEGER NOT NULL DEFAULT 0;
-- CreateTable
CREATE TABLE "redefinicao_senha" (
    "id" UUID NOT NULL,
    "usuarioId" UUID,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "tokenHash" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "redefinicao_senha_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tentativa_login" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tentativa_login_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "redefinicao_senha_tokenHash_key" ON "redefinicao_senha"("tokenHash");
-- CreateIndex
CREATE INDEX "redefinicao_senha_email_criadaEm_idx" ON "redefinicao_senha"("email", "criadaEm");
-- CreateIndex
CREATE INDEX "redefinicao_senha_ip_criadaEm_idx" ON "redefinicao_senha"("ip", "criadaEm");
-- CreateIndex
CREATE INDEX "tentativa_login_email_criadaEm_idx" ON "tentativa_login"("email", "criadaEm");
-- CreateIndex
CREATE INDEX "tentativa_login_ip_criadaEm_idx" ON "tentativa_login"("ip", "criadaEm");
-- AddForeignKey
ALTER TABLE "redefinicao_senha" ADD CONSTRAINT "redefinicao_senha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nenhuma linha é do escritório: a policy só deixa passar o cliente
-- administrativo. Sem isto, o papel da aplicação leria por engano os e-mails
-- que tentaram entrar em QUALQUER escritório.
ALTER TABLE "redefinicao_senha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "redefinicao_senha" FORCE ROW LEVEL SECURITY;
CREATE POLICY so_administrativo ON "redefinicao_senha"
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());

ALTER TABLE "tentativa_login" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tentativa_login" FORCE ROW LEVEL SECURITY;
CREATE POLICY so_administrativo ON "tentativa_login"
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());
