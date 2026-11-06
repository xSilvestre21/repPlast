-- Bombona, frasco, papelão, tampa e os conjuntos com tampa, todos vendidos por
-- milheiro com preço digitado.
--
-- Os CHECKs que falam destas famílias ficam na migration seguinte: um valor novo
-- de enum só pode ser usado depois do commit de quem o criou.

-- AlterEnum
ALTER TYPE "Familia" ADD VALUE 'BOMBONA';
ALTER TYPE "Familia" ADD VALUE 'FRASCO';
ALTER TYPE "Familia" ADD VALUE 'PAPELAO';
ALTER TYPE "Familia" ADD VALUE 'TAMPA';
ALTER TYPE "Familia" ADD VALUE 'FRASCO_TAMPA';
ALTER TYPE "Familia" ADD VALUE 'BOMBONA_TAMPA';

-- AlterTable
ALTER TABLE "produto" ADD COLUMN "capacidade" DECIMAL(10,3);
ALTER TABLE "produto" ADD COLUMN "capacidadeUnidade" TEXT;
ALTER TABLE "produto" ADD COLUMN "alturaCm" DECIMAL(10,2);
ALTER TABLE "produto" ADD COLUMN "diametroMm" DECIMAL(10,2);
ALTER TABLE "produto" ADD COLUMN "materialTampa" TEXT;
ALTER TABLE "produto" ADD COLUMN "complementoTampa" TEXT;
