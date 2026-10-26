-- Pedido de amostra: produto pedido à indústria para o cliente testar, sem
-- custo. Fica fora da comissão, das metas e dos gráficos (ver o comentário do
-- campo no schema). Os pedidos que já existem são vendas.

ALTER TABLE "pedido" ADD COLUMN "amostra" BOOLEAN NOT NULL DEFAULT false;
