-- O vínculo produto-cliente passa a valer sozinho, sem depender do código.
--
-- A linha sempre significou "este produto é deste cliente"; o código era o
-- número que ELE usa, e nem todo cliente numera o que compra. Exigi-lo para
-- gravar o vínculo excluía justamente esses — o produto era da indústria, era
-- do cliente, e ainda assim não aparecia na hora de lançar o pedido.
ALTER TABLE "produto_codigo_cliente" ALTER COLUMN "codigo" DROP NOT NULL;
