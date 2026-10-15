-- O nome do escritório passa a ser único e a poder ser trocado.
--
-- Único entre os escritórios NÃO DESATIVADOS (`ativa`), qualquer que seja a
-- assinatura: quem cancelou e volta a pagar continua com o nome, sem conflito
-- na volta. Nome de escritório desativado, ou que um escritório deixou ao
-- trocar, fica livre para outro — e para ele mesmo voltar ao antigo.
--
-- "Igual" ignora maiúsculas, acentos e espaços repetidos: "Val & Amaral" e
-- "VÁL  &  amaral" são o mesmo nome no topo de quem olha, e não podem ser dois
-- escritórios.

-- A chave de comparação. IMMUTABLE porque entra num índice: depende só do
-- texto. `translate` e não a extensão `unaccent`, que não é IMMUTABLE e nem
-- todo provedor deixa instalar — o português cabe nesta lista.
CREATE OR REPLACE FUNCTION app_chave_nome_escritorio(nome text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$
  SELECT trim(regexp_replace(
    translate(lower(nome), 'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiiooooouuuucny'),
    '\s+', ' ', 'g'))
$fn$;

-- Vale para todos os escritórios, por cima do RLS: o papel da aplicação não
-- enxerga os outros, mas o índice sim. É ele, e não a conferência na ação, que
-- segura dois cadastros com o mesmo nome ao mesmo tempo.
CREATE UNIQUE INDEX "organizacao_nome_unico"
  ON "organizacao" (app_chave_nome_escritorio("nome"))
  WHERE "ativa";

-- "Este nome já é de outro escritório?" — a pergunta que o cadastro e a troca
-- fazem ANTES de gravar, para responder embaixo do campo em vez de estourar no
-- índice. O papel da aplicação não enxerga os outros escritórios (RLS), e
-- abrir o `dbAdministrativo` numa requisição de usuário é justamente o que
-- `db.ts` proíbe. Esta função vê todos, mas só devolve sim ou não: nem o nome
-- nem o escritório que o usa saem daqui.
CREATE OR REPLACE FUNCTION app_nome_escritorio_em_uso(nome text, exceto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET app.bypass_rls = 'on'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM "organizacao" o
    WHERE o."ativa"
      AND app_chave_nome_escritorio(o."nome") = app_chave_nome_escritorio($1)
      AND o."id" IS DISTINCT FROM $2)
$fn$;

-- Cada troca de nome. É por ela que a troca seguinte espera o intervalo, e é
-- o histórico que o suporte consulta ("como se chamava antes?").
CREATE TABLE "troca_nome_escritorio" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "nomeAnterior" TEXT NOT NULL,
    "nomeNovo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "troca_nome_escritorio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "troca_nome_escritorio_organizacaoId_criadaEm_idx"
  ON "troca_nome_escritorio"("organizacaoId", "criadaEm");

ALTER TABLE "troca_nome_escritorio" ADD CONSTRAINT "troca_nome_escritorio_organizacaoId_fkey"
  FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "troca_nome_escritorio" ADD CONSTRAINT "troca_nome_escritorio_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Do escritório inteiro: quem troca é o administrador, mas o histórico é do
-- escritório, não de quem clicou.
ALTER TABLE "troca_nome_escritorio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "troca_nome_escritorio" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "troca_nome_escritorio"
  USING (app_bypass_rls() OR "organizacaoId" = app_organizacao_id())
  WITH CHECK (app_bypass_rls() OR "organizacaoId" = app_organizacao_id());
