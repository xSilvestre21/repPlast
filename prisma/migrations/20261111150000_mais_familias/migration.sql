-- O resto do que o representante de embalagem plástica vende e que só cabia no
-- avulso: pote e balde (soltos e com tampa), gatilho, válvula, pré-forma, saco
-- de ráfia, big bag, plástico bolha, fita de arquear e o selo dela, cantoneira e
-- os descartáveis termoformados.
--
-- Os CHECKs que falam destas famílias ficam na migration seguinte: um valor novo
-- de enum só pode ser usado depois do commit de quem o criou.

-- AlterEnum
ALTER TYPE "Familia" ADD VALUE 'POTE';
ALTER TYPE "Familia" ADD VALUE 'POTE_TAMPA';
ALTER TYPE "Familia" ADD VALUE 'BALDE';
ALTER TYPE "Familia" ADD VALUE 'BALDE_TAMPA';
ALTER TYPE "Familia" ADD VALUE 'GATILHO';
ALTER TYPE "Familia" ADD VALUE 'VALVULA';
ALTER TYPE "Familia" ADD VALUE 'PREFORMA';
ALTER TYPE "Familia" ADD VALUE 'RAFIA';
ALTER TYPE "Familia" ADD VALUE 'BIG_BAG';
ALTER TYPE "Familia" ADD VALUE 'BOLHA';
ALTER TYPE "Familia" ADD VALUE 'FITA_ARQUEAR';
ALTER TYPE "Familia" ADD VALUE 'SELO_ARQUEAR';
ALTER TYPE "Familia" ADD VALUE 'CANTONEIRA';
ALTER TYPE "Familia" ADD VALUE 'DESCARTAVEL';
