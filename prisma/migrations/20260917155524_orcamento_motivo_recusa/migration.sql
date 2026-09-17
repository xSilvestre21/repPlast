-- Por que a proposta foi recusada.
--
-- Nulo em tudo que já existe, e continua opcional depois: no momento em que a
-- proposta cai nem sempre se sabe o porquê, e exigir o motivo ali empurraria
-- quem não sabe a inventar um. Quem souber depois escreve na própria proposta.
ALTER TABLE "orcamento" ADD COLUMN     "motivoRecusa" TEXT;
