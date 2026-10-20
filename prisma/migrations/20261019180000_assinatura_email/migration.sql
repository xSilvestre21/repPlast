-- A assinatura de cada caixa de e-mail, colada do Gmail/Outlook e guardada já
-- limpa. Nula: os e-mails saem sem assinatura, como sempre saíram.

-- AlterTable
ALTER TABLE "conta_email" ADD COLUMN     "assinaturaHtml" TEXT;
