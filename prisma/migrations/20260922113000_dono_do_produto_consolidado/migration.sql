-- Uma verdade só sobre de quem é o produto.
--
-- Havia duas, e elas não se falavam: `produto.clienteId` dizia de quem o produto
-- é, e `produto_codigo_cliente` dizia a mesma coisa em outra tabela. Cadastrar
-- produto preenchia a primeira; lançar item lia só a segunda. O resultado é que
-- o produto do cliente simplesmente não aparecia na hora de montar o pedido ou a
-- proposta — 23 dos 76 orçamentos com cliente não ofereciam nada, e metade dos
-- pedidos também não.
--
-- A tabela de vínculo era um muitos-para-muitos para uma relação que o projeto
-- inteiro trata como um-para-muitos: o mesmo saco cotado para dois clientes já é
-- dois produtos, com preço próprio cada um. Dos 188 vínculos existentes, 186
-- apontavam para o mesmo cliente que o produto já declarava.
--
-- Sobra o que a tabela tinha de próprio — o número que ELE usa —, e ele vira
-- coluna do produto, ao lado do número que a indústria usa.

ALTER TABLE "produto" ADD COLUMN "codigoCliente" TEXT;

-- 1. O código vem para o produto de quem ele já era.
UPDATE "produto" p
SET "codigoCliente" = pcc."codigo"
FROM "produto_codigo_cliente" pcc
WHERE pcc."produtoId" = p."id"
  AND pcc."clienteId" = p."clienteId"
  AND pcc."codigo" IS NOT NULL;

-- 2. Produto sem dono que tinha vínculo adota aquele cliente.
--
-- São os dois sacos da MARIOL que entraram como item de catálogo e só existiam
-- como dela através da tabela de vínculo. Sem este passo eles perderiam o dono e
-- o código de uma vez. O `NOT EXISTS` garante que só adota quem tem um vínculo
-- só — com dois, a escolha não seria do banco.
UPDATE "produto" p
SET "clienteId" = pcc."clienteId",
    "codigoCliente" = pcc."codigo"
FROM "produto_codigo_cliente" pcc
WHERE pcc."produtoId" = p."id"
  AND p."clienteId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "produto_codigo_cliente" outro
     WHERE outro."produtoId" = p."id"
       AND outro."clienteId" <> pcc."clienteId"
  );

-- Leva junto a policy `tenant_isolation`, os índices e as chaves estrangeiras.
DROP TABLE "produto_codigo_cliente";

-- A forma exata da consulta que monta a lista ao lançar item.
CREATE INDEX "produto_organizacaoId_clienteId_fornecedorId_idx"
    ON "produto"("organizacaoId", "clienteId", "fornecedorId");
