-- O pedido cancelado passa a poder dizer POR QUE.
--
-- Ele já sai da soma da comissão e, desde agora, continua aparecendo na lista do
-- mês como cancelado. Faltava o essencial: a linha zerada não dizia o que
-- aconteceu, e sobrava ao representante lembrar de cor três meses depois.
--
-- É o mesmo campo que a proposta recusada tem desde `orcamento_motivo_recusa`, e
-- pela mesma razão — a diferença entre um registro mudo e uma perda explicada.
ALTER TABLE "pedido" ADD COLUMN "motivoCancelamento" TEXT;
