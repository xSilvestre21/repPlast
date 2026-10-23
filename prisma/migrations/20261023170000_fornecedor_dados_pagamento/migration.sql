-- Dados para pagamento da indústria (PIX, banco, conta, favorecido), em texto
-- livre, para a representante copiar e enviar a quem precisar.
--
-- O RLS e o `fornecedor_so_do_admin` já valem para a coluna nova: o trigger
-- compara a linha inteira, então o preposto lê mas não altera.

ALTER TABLE "fornecedor" ADD COLUMN "dadosPagamento" TEXT;
