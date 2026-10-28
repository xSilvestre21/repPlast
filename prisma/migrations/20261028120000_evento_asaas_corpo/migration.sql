-- O corpo do evento do Asaas e o escritório a que ele se refere. Sem os dois,
-- o evento já processado era só id e tipo: não dava para saber de quem era nem
-- o que dizia (os eventos de 21/10). O corpo é apagado depois de 90 dias
-- (`asaas-webhook.ts`); a linha fica, porque é ela que impede processar o mesmo
-- evento de novo. Sem chave estrangeira: escritório excluído não apaga o
-- histórico de cobrança dele.

ALTER TABLE "evento_asaas" ADD COLUMN "corpo" JSONB;
ALTER TABLE "evento_asaas" ADD COLUMN "organizacaoId" UUID;
