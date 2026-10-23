-- Troca do e-mail de login, com confirmação pelo endereço novo.
--
-- Como `redefinicao_senha`: o link é aberto sem garantia de sessão (pode ser no
-- celular), então a tabela não tem escopo de escritório e só o cliente
-- administrativo a lê e escreve.

-- CreateTable
CREATE TABLE "troca_email" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "emailNovo" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "troca_email_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "troca_email_tokenHash_key" ON "troca_email"("tokenHash");
-- CreateIndex
CREATE INDEX "troca_email_usuarioId_criadaEm_idx" ON "troca_email"("usuarioId", "criadaEm");
-- AddForeignKey
ALTER TABLE "troca_email" ADD CONSTRAINT "troca_email_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "troca_email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "troca_email" FORCE ROW LEVEL SECURITY;
CREATE POLICY so_administrativo ON "troca_email"
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());
