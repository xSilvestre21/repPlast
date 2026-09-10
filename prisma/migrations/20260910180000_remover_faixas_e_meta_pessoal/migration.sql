-- Remove as faixas de comissão por volume e troca a apuração gravada por uma
-- meta pessoal do representante.
--
-- Por quê: o usuário verificou que nenhuma das indústrias que ele representa
-- trabalha com faixa por volume. A faixa contaminava o cálculo inteiro (modo
-- progressivo x retroativo, meta em reais x quilos) para atender um caso que
-- não existe no dia a dia dele.
--
-- Com a faixa fora, a comissão de um pedido é simplesmente `base × percentual`,
-- e o percentual passa a ser congelado no próprio pedido. Isso torna a apuração
-- derivável dos pedidos a qualquer momento e historicamente correta — o que
-- elimina a necessidade das tabelas de apuração e lançamento.

-- ---------------------------------------------------------------------------
-- Congela o percentual nos pedidos que ainda não têm um
-- ---------------------------------------------------------------------------
-- Sem isto, pedidos antigos passariam a usar o percentual atual da indústria e
-- a comissão de meses fechados mudaria sozinha.

UPDATE "pedido" p
SET "comissaoPercentual" = f."comissaoPercentual"
FROM "fornecedor" f
WHERE f."id" = p."fornecedorId"
  AND p."comissaoPercentual" IS NULL;

-- ---------------------------------------------------------------------------
-- Fora as tabelas da apuração
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "comissao_lancamento";
DROP TABLE IF EXISTS "comissao_apuracao";
DROP TABLE IF EXISTS "faixa_comissao";

DROP TYPE IF EXISTS "TipoLancamento";

-- ---------------------------------------------------------------------------
-- Fora a configuração de meta do fornecedor
-- ---------------------------------------------------------------------------

ALTER TABLE "fornecedor" DROP COLUMN IF EXISTS "unidadeMeta";
ALTER TABLE "fornecedor" DROP COLUMN IF EXISTS "modoFaixa";

DROP TYPE IF EXISTS "UnidadeMeta";
DROP TYPE IF EXISTS "ModoFaixa";

-- ---------------------------------------------------------------------------
-- A meta agora é do representante
-- ---------------------------------------------------------------------------

ALTER TABLE "organizacao" ADD COLUMN "metaComissaoMensal" DECIMAL(14,2);
