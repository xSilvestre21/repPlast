-- O "olho" do Painel: cada usuário escolhe se os valores em reais aparecem ou
-- ficam mascarados. Começa visível para todo mundo — ninguém perde o número
-- que estava acostumado a ver ao abrir o sistema.
ALTER TABLE "usuario" ADD COLUMN "ocultarValores" BOOLEAN NOT NULL DEFAULT false;
