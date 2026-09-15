-- AlterTable
ALTER TABLE "orcamento" ADD COLUMN     "clienteAvulsoMunicipio" TEXT,
ADD COLUMN     "clienteAvulsoNome" TEXT,
ALTER COLUMN "clienteId" DROP NOT NULL;

-- Toda proposta precisa de um destinatário: ou um cliente do cadastro, ou pelo
-- menos o nome de quem pediu o preço. Sem um dos dois, o documento não sabe
-- para quem vai — e é um papel que se imprime e se manda.
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_tem_destinatario" CHECK (
  "clienteId" IS NOT NULL OR "clienteAvulsoNome" IS NOT NULL
);
