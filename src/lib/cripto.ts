/**
 * Cifra o que precisa voltar a ser lido — hoje, a senha da caixa de e-mail.
 *
 * Senha de LOGIN não passa por aqui: aquela só se confere, e mora em
 * `senha.ts` como hash. A do e-mail é diferente, porque o sistema precisa dela
 * de volta para entrar no servidor SMTP em cada envio.
 *
 * AES-256-GCM, do próprio Node. O GCM autentica além de cifrar: um texto
 * adulterado no banco não decifra em lixo, lança — e é isso que se quer de algo
 * que vai virar credencial.
 *
 * A chave vem de `EMAIL_CHAVE` (32 bytes em base64; gerar com
 * `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
 * Perdê-la não derruba nada além das contas de e-mail, que precisarão da senha
 * digitada de novo.
 */

import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSAO = "v1";

function chave(): Buffer {
  const bruta = process.env.EMAIL_CHAVE;
  if (!bruta) {
    throw new Error(
      "EMAIL_CHAVE não está definida no .env — sem ela não dá para guardar a senha do e-mail.",
    );
  }

  const bytes = Buffer.from(bruta, "base64");
  if (bytes.length !== 32) {
    throw new Error("EMAIL_CHAVE precisa ter 32 bytes em base64.");
  }
  return bytes;
}

/** Diz se a chave existe, para a tela avisar antes de a pessoa digitar a senha. */
export function criptoConfigurada(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}

/** `v1:iv:tag:dados`, tudo em base64. A versão deixa trocar o esquema depois. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);

  return [VERSAO, iv, cifra.getAuthTag(), dados]
    .map((parte) => (typeof parte === "string" ? parte : parte.toString("base64")))
    .join(":");
}

export function decifrar(guardado: string): string {
  const [versao, iv, tag, dados] = guardado.split(":");

  if (versao !== VERSAO || !iv || !tag || dados === undefined) {
    throw new Error("Senha guardada em formato desconhecido.");
  }

  const decifra = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
  decifra.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([decifra.update(Buffer.from(dados, "base64")), decifra.final()]).toString(
    "utf8",
  );
}
