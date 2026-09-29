-- O texto com que o e-mail do pedido abre passa a ser de cada usuário.
--
-- Até aqui era fixo no código ("Segue em anexo o pedido nº…"); dava para editar
-- em cada envio, mas não para mudar o ponto de partida. Nulo continua querendo
-- dizer o texto de sempre, então ninguém percebe a migration até escrever o seu.
ALTER TABLE "usuario" ADD COLUMN "assuntoEnvioPadrao" TEXT;
ALTER TABLE "usuario" ADD COLUMN "mensagemEnvioPadrao" TEXT;
