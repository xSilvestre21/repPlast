-- Cada tentativa de cadastro que passou da conferência dos campos.
--
-- O cadastro é a porta mais cara do sistema e a única aberta a qualquer um:
-- cada tentativa consulta o CEP e o domínio do e-mail e abre um checkout no
-- Asaas. Sem limite, um robô abriria milhares de checkouts — e é a conta do
-- Asaas que fica marcada. O limite conta estas linhas (`lib/tentativas-cadastro.ts`).
CREATE TABLE "tentativa_cadastro" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativa_cadastro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tentativa_cadastro_email_criadaEm_idx" ON "tentativa_cadastro"("email", "criadaEm");
CREATE INDEX "tentativa_cadastro_ip_criadaEm_idx" ON "tentativa_cadastro"("ip", "criadaEm");

-- Nenhuma linha é do escritório (ele nem existe ainda): só o cliente
-- administrativo passa, como em `tentativa_login`.
ALTER TABLE "tentativa_cadastro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tentativa_cadastro" FORCE ROW LEVEL SECURITY;
CREATE POLICY so_administrativo ON "tentativa_cadastro"
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());
