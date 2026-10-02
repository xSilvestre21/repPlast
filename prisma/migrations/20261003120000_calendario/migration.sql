-- O calendário: compromissos marcados à mão, com importância, e o "lembrar
-- depois" de cada pessoa. Entregas, parcelas e clientes sumidos NÃO moram
-- aqui: o calendário os lê das tabelas de origem, então nunca ficam
-- desatualizados em relação a elas.

-- CreateEnum
CREATE TYPE "Importancia" AS ENUM ('NORMAL', 'IMPORTANTE', 'URGENTE');

-- CreateTable
CREATE TABLE "compromisso" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "anotacao" TEXT,
    "data" DATE NOT NULL,
    "hora" VARCHAR(5),
    "importancia" "Importancia" NOT NULL DEFAULT 'NORMAL',
    "compartilhado" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" UUID,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso_adiado" (
    "usuarioId" UUID NOT NULL,
    "compromissoId" UUID NOT NULL,
    "ate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aviso_adiado_pkey" PRIMARY KEY ("usuarioId","compromissoId")
);

-- CreateIndex
CREATE INDEX "compromisso_organizacaoId_data_idx" ON "compromisso"("organizacaoId", "data");

-- CreateIndex
CREATE INDEX "compromisso_clienteId_idx" ON "compromisso"("clienteId");

-- CreateIndex
CREATE INDEX "aviso_adiado_compromissoId_idx" ON "aviso_adiado"("compromissoId");

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_adiado" ADD CONSTRAINT "aviso_adiado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_adiado" ADD CONSTRAINT "aviso_adiado_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A hora, quando existe, é "HH:MM" de verdade; e um compromisso sem título é
-- um clique errado, não um compromisso.
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_hora_valida"
  CHECK ("hora" IS NULL OR "hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_titulo_preenchido"
  CHECK (length(btrim("titulo")) > 0);

-- Ler: o meu, ou o que alguém do escritório compartilhou. O administrador NÃO
-- vê o pessoal do preposto — foi a escolha do usuário: compromisso pessoal é
-- de quem marcou.
--
-- Escrever: só o autor, mesmo no compartilhado. Duas policies, e não uma: o
-- UPDATE e o DELETE filtram pelo USING, e uma policy só com "meu OU
-- compartilhado" deixaria qualquer um apagar o compromisso compartilhado do
-- colega (a mesma armadilha corrigida em `repasse_preposto`).
ALTER TABLE "compromisso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compromisso" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "compromisso"
  FOR SELECT
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND ("autorId" = app_usuario_id() OR "compartilhado")));
CREATE POLICY escrita_do_autor ON "compromisso"
  FOR ALL
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "autorId" = app_usuario_id()))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND "autorId" = app_usuario_id()));

-- O adiamento é de cada um, e só dele — para ler e para escrever.
ALTER TABLE "aviso_adiado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aviso_adiado" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aviso_adiado"
  USING (app_bypass_rls() OR "usuarioId" = app_usuario_id())
  WITH CHECK (app_bypass_rls() OR "usuarioId" = app_usuario_id());
