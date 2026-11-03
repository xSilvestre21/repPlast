/**
 * O filtro do que vai para o Sentry (`instrumentation.ts` e
 * `instrumentation-client.ts`) — o último ponto antes de o erro sair daqui.
 *
 * Dois trabalhos:
 *
 *   - descartar o que não é erro do sistema: o `MaxListenersExceededWarning`
 *     que o túnel `/monitoramento` escreve a cada envio num `next start`
 *     próprio (fora do Vercel). Capturado, ele virava um "erro" por erro;
 *   - mascarar dado pessoal. Todo `console.error` do servidor vai para lá, e
 *     alguns levam o que a pessoa digitou — o erro do Prisma repete os
 *     argumentos da consulta; a recusa do Asaas, o corpo da resposta. E-mail,
 *     CPF e CNPJ saem trocados por um marcador; o resto do texto fica, que é
 *     o que diz o que houve.
 *
 * Sem `server-only`: roda também no navegador.
 */

const DESCARTAR = ["MaxListenersExceededWarning"];

const MASCARAS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  // Formatado e só com dígitos. Os 11 dígitos pegam também o celular com DDD,
  // que é dado pessoal do mesmo jeito.
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[cnpj]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[cpf]"],
  [/\b\d{14}\b/g, "[cnpj]"],
  [/\b\d{11}\b/g, "[cpf]"],
];

export function mascarar(texto: string): string {
  return MASCARAS.reduce((atual, [padrao, marcador]) => atual.replace(padrao, marcador), texto);
}

/** Troca, em qualquer nível, cada texto pela versão mascarada. */
function mascararTudo(valor: unknown, vistos: WeakSet<object>): unknown {
  if (typeof valor === "string") return mascarar(valor);
  if (!valor || typeof valor !== "object" || vistos.has(valor)) return valor;
  vistos.add(valor);

  if (Array.isArray(valor)) return valor.map((item) => mascararTudo(item, vistos));
  return Object.fromEntries(Object.entries(valor).map(([chave, dentro]) => [chave, mascararTudo(dentro, vistos)]));
}

/** O `beforeSend`: o evento limpo, ou `null` para não enviar. */
export function filtrarEvento<T extends object>(evento: T): T | null {
  let texto: string;
  try {
    texto = JSON.stringify(evento);
  } catch {
    texto = "";
  }
  if (DESCARTAR.some((marca) => texto.includes(marca))) return null;

  return mascararTudo(evento, new WeakSet()) as T;
}
