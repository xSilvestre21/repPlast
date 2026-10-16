/**
 * Túnel do webhook do Asaas para o servidor de desenvolvimento.
 *
 * O Asaas avisa o pagamento por um POST em `/api/asaas/webhook` (é ele que
 * tira o escritório de "aguardando pagamento"), e um POST da internet não
 * alcança o `127.0.0.1` de ninguém. Este script:
 *
 *   1. abre um túnel do cloudflared (gratuito, sem conta) para a porta 3000;
 *   2. cadastra — ou atualiza — o webhook "RepPlast local" no SANDBOX do
 *      Asaas, apontando para o endereço do túnel, que muda a cada execução;
 *   3. fica aberto até o Ctrl+C, que fecha o túnel.
 *
 * Só fala com o sandbox: com `ASAAS_URL` de produção ele se recusa, para
 * nunca apontar o webhook de verdade para um computador.
 *
 * Uso, com o `npm run dev` rodando em outro terminal:
 *   npm run tunel
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import nextEnv from "@next/env";

// O mesmo carregador do Next: a chave "\$aact_..." chega aqui como chega no app.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });

const NOME_WEBHOOK = "RepPlast local";
const PORTA_LOCAL = "http://127.0.0.1:3000";
const CAMINHO = "/api/asaas/webhook";
/** Os eventos que `lib/asaas-webhook.ts` trata. Outro evento seria só ruído na fila. */
const EVENTOS = [
  "CHECKOUT_PAID",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_DELETED",
  "SUBSCRIPTION_INACTIVATED",
];

function parar(mensagem) {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

const asaas = process.env.ASAAS_URL?.trim().replace(/\/+$/, "");
const chave = process.env.ASAAS_API_KEY?.trim();
const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
const email =
  process.env.ASAAS_WEBHOOK_EMAIL?.trim() || process.env.SISTEMA_EMAIL_REMETENTE?.trim();

if (!asaas || !chave) parar("ASAAS_URL ou ASAAS_API_KEY vazia no .env.");
if (!asaas.includes("sandbox")) {
  parar(`ASAAS_URL é ${asaas}, que não é o sandbox. Este script só aponta o webhook de TESTE.`);
}
if (!token || token.length < 32) parar("ASAAS_WEBHOOK_TOKEN vazio ou com menos de 32 caracteres no .env.");
if (!email) parar("Falta um e-mail para o Asaas avisar problemas do webhook: SISTEMA_EMAIL_REMETENTE no .env.");

/** O cloudflared no PATH, ou onde o instalador do winget o põe (o PATH só atualiza em terminal novo). */
function acharCloudflared() {
  const candidatos = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
  ];
  return candidatos.find((caminho) => existsSync(caminho)) ?? "cloudflared";
}

async function chamarAsaas(metodo, caminho, corpo) {
  const resposta = await fetch(`${asaas}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", "User-Agent": "RepPlast", access_token: chave },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`Asaas ${metodo} ${caminho} → ${resposta.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function apontarWebhook(url) {
  const dados = {
    name: NOME_WEBHOOK,
    url: `${url}${CAMINHO}`,
    email,
    enabled: true,
    // Uma fila pausada (o túnel de ontem fora do ar) não entregaria mais nada.
    interrupted: false,
    apiVersion: 3,
    authToken: token,
    sendType: "SEQUENTIALLY",
    events: EVENTOS,
  };

  const lista = await chamarAsaas("GET", "/v3/webhooks?limit=100");
  const existente = (lista?.data ?? []).find((webhook) => webhook.name === NOME_WEBHOOK);

  if (existente) {
    await chamarAsaas("PUT", `/v3/webhooks/${existente.id}`, dados);
    return "atualizado";
  }
  await chamarAsaas("POST", "/v3/webhooks", dados);
  return "criado";
}

// O servidor de desenvolvimento precisa estar no ar: é ele quem recebe.
try {
  await fetch(PORTA_LOCAL, { signal: AbortSignal.timeout(5000) });
} catch {
  parar(`Nada respondendo em ${PORTA_LOCAL}. Rode o "npm run dev" em outro terminal antes.`);
}

console.log("Abrindo o túnel…");
const tunel = spawn(acharCloudflared(), ["tunnel", "--no-autoupdate", "--url", PORTA_LOCAL], {
  stdio: ["ignore", "pipe", "pipe"],
});
tunel.on("error", () => parar("Não achei o cloudflared. Instale com: winget install Cloudflare.cloudflared"));
tunel.on("exit", (codigo) => {
  console.log(`\nTúnel fechado${codigo ? ` (código ${codigo})` : ""}.`);
  process.exit(codigo ?? 0);
});
// No Windows, o filho sobrevive ao pai que morre: sem isto, sobrava um cloudflared solto.
process.on("SIGINT", () => tunel.kill());
process.on("SIGTERM", () => tunel.kill());
process.on("exit", () => tunel.kill());

/*
 * Espera o cloudflared dizer as duas coisas: o endereço, e que a conexão com a
 * Cloudflare foi registrada. NÃO se testa o endereço daqui: perguntado cedo
 * demais, o Windows guarda o "domínio não existe" em cache por minutos, e o
 * teste falharia com o túnel já no ar. Quem precisa achar o endereço é o Asaas.
 */
let url = null;
let registrado = false;
let apontado = false;
const aoLer = async (pedaco) => {
  const texto = pedaco.toString();
  url ??= texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] ?? null;
  registrado ||= /Registered tunnel connection/i.test(texto);
  if (!url || !registrado || apontado) return;
  apontado = true;

  console.log(`Túnel no ar: ${url}`);
  try {
    const feito = await apontarWebhook(url);
    console.log(`\n✔ Webhook "${NOME_WEBHOOK}" ${feito} no sandbox do Asaas → ${url}${CAMINHO}`);
    console.log("  Pagamentos de teste agora liberam o escritório. Deixe este terminal aberto; Ctrl+C fecha.\n");
  } catch (erro) {
    console.error(`\n✖ O túnel abriu, mas o webhook não foi cadastrado:\n  ${erro.message}\n`);
  }
};
tunel.stdout.on("data", aoLer);
tunel.stderr.on("data", aoLer);
