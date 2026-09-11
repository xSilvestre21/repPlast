-- O IPI passa a ser decidido SÓ no item.
--
-- `pedido.comIpi` era um interruptor mestre: desligado, isentava o pedido
-- inteiro independentemente do que cada linha dissesse. Com a isenção por item
-- ele virou um segundo jeito de fazer a mesma coisa — e um jeito capaz de
-- zerar o IPI de uma linha marcada, sem nada na tela explicando por quê.
--
-- A ORDEM IMPORTA: primeiro o estado antigo é gravado nos itens, e só depois a
-- coluna some. Ao contrário, os pedidos isentos voltariam a ser tributados.

UPDATE "pedido_item"
SET "comIpi" = false
WHERE "pedidoId" IN (SELECT "id" FROM "pedido" WHERE "comIpi" = false);

ALTER TABLE "pedido" DROP COLUMN "comIpi";
