-- A senha inicial do preposto, que só ele troca depois.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "senhaProvisoria" BOOLEAN NOT NULL DEFAULT false;

-- Os prepostos de antes: a senha deles foi escolhida pelo administrador, que
-- a conhece. Ficam marcados, e o sistema sugere a troca no próximo acesso.
UPDATE "usuario" SET "senhaProvisoria" = true WHERE "papel" = 'REPRESENTANTE';
