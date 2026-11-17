/**
 * As variáveis de ambiente de produção, conferidas na subida do servidor
 * (`instrumentation.ts`) — e não na primeira vez que alguém precisa delas.
 *
 * Cada módulo já recusa a própria variável ausente (`db.ts`, `sessao.ts`,
 * `cripto.ts`, `asaas.ts`…), mas só quando é chamado, e algumas faltas não dão
 * erro nenhum:
 *
 *   - `APP_DB_ROLE` vazio desliga o papel restrito, e com ele o isolamento
 *     entre escritórios no banco — sem aviso (ver `db.ts`);
 *   - a chave do Asaas copiada do `.env` com a barra (`\$aact_…`) dá 401 em
 *     toda chamada, e só aparece quando alguém tenta pagar;
 *   - sem o SMTP do sistema, o "Esqueceu sua senha?" responde que mandou o
 *     e-mail, e não manda;
 *   - sem `ROTINA_TOKEN`, a rotina diária recusa o cron, e o e-mail de "o teste
 *     grátis está acabando" nunca sai;
 *   - sem `TZ`, o container fica em UTC, e depois das 21h o "hoje" do
 *     calendário e a data do PDF da proposta já são amanhã (`problemaNoFuso`).
 *
 * Fora do Vercel (a hospedagem de verdade), a falta impede o servidor de
 * subir, e o deploy volta para a versão anterior. No Vercel, que é só a
 * demonstração, vira um erro no log e no Sentry, sem derrubar a página.
 */

import { z } from "zod";

const PAPEL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * https, salvo o próprio PC ou a rede local: o build de produção também é
 * aberto ali (`next start`) para medir desempenho, e lá não há certificado.
 */
function urlDoSistemaAceita(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    )
  );
}

const obrigatoria = (motivo: string) =>
  z.string({ error: `ausente — ${motivo}` }).trim().min(1, { error: `vazia — ${motivo}`, abort: true });

const ESQUEMA = z.object({
  DATABASE_URL: obrigatoria("a conexão da aplicação com o banco").regex(
    /^postgres(ql)?:\/\//,
    "não parece uma URL do PostgreSQL (postgresql://…)",
  ),
  APP_DB_ROLE: obrigatoria("sem ela o isolamento entre escritórios no banco fica desligado").regex(
    PAPEL,
    "nome de papel inválido",
  ),
  SESSAO_SECRET: z
    .string({ error: "ausente — assina o cookie de sessão" })
    .min(32, "curta demais — use pelo menos 32 caracteres aleatórios"),
  EMAIL_CHAVE: obrigatoria("cifra a senha das caixas de e-mail").refine(
    (valor) => Buffer.from(valor, "base64").length === 32,
    "precisa ter 32 bytes em base64",
  ),
  APP_URL: obrigatoria("base dos links dos e-mails e da volta do checkout").refine(
    urlDoSistemaAceita,
    "precisa começar com https:// (ex.: https://repplast.com.br)",
  ),
  ASAAS_URL: obrigatoria("o endereço da API do Asaas").regex(/^https:\/\//, "precisa começar com https://"),
  ASAAS_API_KEY: obrigatoria("a chave de API do Asaas").refine(
    (valor) => !valor.startsWith("\\"),
    "começa com \\ — no painel o valor é literal; tire a barra que o .env exige",
  ),
  ASAAS_WEBHOOK_TOKEN: obrigatoria("o token que o Asaas manda no webhook"),
  SISTEMA_SMTP_HOST: obrigatoria('o servidor de e-mail do "Esqueceu sua senha?"'),
  // O SES (e qualquer SMTP de verdade) recusa envio sem login. Sem os dois, o
  // erro só apareceria quando alguém pedisse uma senha nova.
  SISTEMA_SMTP_USUARIO: obrigatoria('o usuário SMTP do "Esqueceu sua senha?" (no SES, a credencial SMTP)'),
  SISTEMA_SMTP_SENHA: obrigatoria('a senha SMTP do "Esqueceu sua senha?" (no SES, a credencial SMTP)'),
  SISTEMA_EMAIL_REMETENTE: obrigatoria('o remetente do "Esqueceu sua senha?"'),
  SISTEMA_SMTP_PORTA: z
    .string()
    .trim()
    .regex(/^\d*$/, "precisa ser um número (587 ou 465)")
    .optional(),
  ROTINA_TOKEN: z
    .string({ error: "ausente — autoriza o cron a chamar a rotina diária (o lembrete do teste grátis)" })
    .trim()
    .min(32, "curto demais — use pelo menos 32 caracteres aleatórios"),
});

/** O que está errado, uma frase por variável — vazio quando está tudo certo. */
export function problemasDoAmbiente(ambiente: Record<string, string | undefined>): string[] {
  const resultado = ESQUEMA.safeParse(ambiente);
  const problemas = resultado.success
    ? []
    : resultado.error.issues.map((problema) => `${problema.path.join(".")}: ${problema.message}`);

  // A chave de API no lugar do token: o webhook passaria a aceitar quem tivesse a chave.
  if (ambiente.ASAAS_WEBHOOK_TOKEN?.trim() && ambiente.ASAAS_WEBHOOK_TOKEN.trim() === ambiente.ASAAS_API_KEY?.trim()) {
    problemas.push("ASAAS_WEBHOOK_TOKEN: igual à ASAAS_API_KEY — o token do webhook é outro, inventado no painel");
  }
  // Um segredo para cada porta: vazado um, o outro continua fechado.
  const rotina = ambiente.ROTINA_TOKEN?.trim();
  if (rotina && [ambiente.ASAAS_WEBHOOK_TOKEN, ambiente.ASAAS_API_KEY, ambiente.SESSAO_SECRET].some((v) => v?.trim() === rotina)) {
    problemas.push("ROTINA_TOKEN: igual a outro segredo — gere um só para a rotina (openssl rand -hex 32)");
  }
  return problemas;
}

/** O horário do sistema: o de Brasília, que é o de quem usa. */
export const FUSO_DO_SISTEMA = "America/Sao_Paulo";

/**
 * O servidor está no horário de Brasília?
 *
 * "Hoje" (`hojeIso`), o mês atual (`competenciaDe(new Date())`) e a data
 * impressa no PDF da proposta e do pedido saem do relógio do servidor. No PC,
 * onde o sistema foi feito e conferido, ele é o de Brasília; num container ele
 * é UTC, que vira o dia às 21h — a proposta das 22h sairia datada de amanhã, e
 * no último dia do mês o painel abriria no mês seguinte. O `Dockerfile` fixa o
 * `TZ`; isto garante que ele valeu.
 */
export function problemaNoFuso(fuso: string): string | null {
  if (fuso === FUSO_DO_SISTEMA) return null;
  return (
    `TZ: o servidor está em ${fuso || "um fuso desconhecido"}, e não no horário de Brasília — ` +
    `defina TZ=${FUSO_DO_SISTEMA} (a imagem do Dockerfile já define)`
  );
}

/** Na subida, em produção: recusa (ou, no Vercel, avisa) o ambiente incompleto. */
export function conferirAmbiente(): void {
  if (process.env.NODE_ENV !== "production") return;

  const problemas = problemasDoAmbiente(process.env);
  // O Vercel não deixa trocar o fuso: lá é sempre UTC. É só a demonstração, e
  // avisar a cada subida gastaria a cota do Sentry repetindo a mesma coisa.
  if (!process.env.VERCEL) {
    const fuso = problemaNoFuso(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (fuso) problemas.push(fuso);
  }
  if (problemas.length === 0) return;

  const mensagem = `[ambiente] variáveis de produção com problema:\n  - ${problemas.join("\n  - ")}`;
  if (process.env.VERCEL) {
    console.error(mensagem);
    return;
  }
  throw new Error(mensagem);
}
