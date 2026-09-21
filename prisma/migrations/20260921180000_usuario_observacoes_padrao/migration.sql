-- O texto padrão de "Condições" passa a ser de cada usuário, não do escritório
-- inteiro: representantes diferentes costumam preencher com texto diferente.
--
-- O que já existia em `organizacao.observacoesPadrao` migra para o
-- administrador do escritório, que é quem o SICOV importou como dono desse
-- texto — os demais usuários começam sem padrão e definem o deles.
ALTER TABLE "usuario" ADD COLUMN     "observacoesPadrao" TEXT;

UPDATE "usuario" u
SET "observacoesPadrao" = o."observacoesPadrao"
FROM "organizacao" o
WHERE u."organizacaoId" = o.id
  AND u."papel" = 'ADMIN'
  AND o."observacoesPadrao" IS NOT NULL;

ALTER TABLE "organizacao" DROP COLUMN "observacoesPadrao";
