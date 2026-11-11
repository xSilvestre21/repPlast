-- Batoque e alça para gargalo, vendidos soltos por milheiro e medidos pelo
-- gargalo onde entram (o catálogo da Alemolde tem quatro batoques e uma alça).
--
-- O CHECK que fala destas famílias fica na migration seguinte: um valor novo de
-- enum só pode ser usado depois do commit de quem o criou.

-- AlterEnum
ALTER TYPE "Familia" ADD VALUE 'BATOQUE';
ALTER TYPE "Familia" ADD VALUE 'ALCA';
