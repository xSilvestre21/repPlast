-- AlterTable
ALTER TABLE "material" ADD COLUMN     "precoMinimoKg" DECIMAL(12,4);

-- O CHECK precisa cobrir a coluna nova: piso negativo não quer dizer nada, e
-- passaria despercebido porque nada bloqueia venda abaixo do piso.
ALTER TABLE "material" DROP CONSTRAINT "material_valores_nao_negativos";
ALTER TABLE "material" ADD CONSTRAINT "material_valores_nao_negativos" CHECK (
  "precoKg" >= 0 AND coalesce("precoMinimoKg", 0) >= 0
  AND coalesce("densidade", 0) >= 0
);
