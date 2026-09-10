/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `fornecedor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fornecedor" DROP COLUMN "logoUrl",
ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logoTipo" TEXT;
