import "server-only";

import { Resolver } from "node:dns/promises";

/**
 * O domínio do e-mail recebe mensagem? A segunda camada de `email-valido.ts`.
 *
 * Pergunta pelo registro MX — é ele que diz para onde vão os e-mails do
 * domínio. Sem MX, vale o endereço do próprio domínio (o "MX implícito" da RFC
 * 5321), então ainda se procura um A/AAAA antes de recusar.
 *
 * Duas vias. Primeiro o servidor DNS da máquina. Há máquinas em que ele recusa
 * a conexão (proxy local, VPN, antivírus que intercepta DNS); aí a mesma
 * pergunta vai por HTTPS ao DNS público da Cloudflare. O `lookup` do sistema
 * operacional NÃO serve de plano B: ele só sabe de site (A), e empresa com
 * e-mail no domínio e sem site seria recusada por engano.
 *
 * Só recusa quando uma das vias RESPONDE que não há nada. Se nenhuma
 * responder, deixa passar: DNS fora do ar não pode impedir alguém de assinar.
 */

const resolvedor = new Resolver({ timeout: 3000, tries: 2 });

/** As respostas que AFIRMAM a ausência: domínio inexistente, ou existente sem o registro. */
const NAO_EXISTE = new Set(["ENOTFOUND", "ENODATA"]);

type Resposta = boolean | null; // null: não deu para saber

async function peloServidorDaMaquina(dominio: string, tipo: "MX" | "A" | "AAAA"): Promise<Resposta> {
  try {
    const registros =
      tipo === "MX"
        ? await resolvedor.resolveMx(dominio)
        : tipo === "A"
          ? await resolvedor.resolve4(dominio)
          : await resolvedor.resolve6(dominio);
    return registros.length > 0;
  } catch (erro) {
    return NAO_EXISTE.has((erro as { code?: string })?.code ?? "") ? false : null;
  }
}

/** Códigos de https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/ */
const TIPO_NUMERICO = { MX: 15, A: 1, AAAA: 28 } as const;
const NXDOMAIN = 3;

async function porHttps(dominio: string, tipo: "MX" | "A" | "AAAA"): Promise<Resposta> {
  try {
    const resposta = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=${tipo}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(3000), cache: "no-store" },
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { Status: number; Answer?: { type: number }[] };
    if (dados.Status === NXDOMAIN) return false;
    if (dados.Status !== 0) return null;
    return (dados.Answer ?? []).some((registro) => registro.type === TIPO_NUMERICO[tipo]);
  } catch {
    return null;
  }
}

async function temRegistro(dominio: string, tipo: "MX" | "A" | "AAAA"): Promise<Resposta> {
  const local = await peloServidorDaMaquina(dominio, tipo);
  return local !== null ? local : porHttps(dominio, tipo);
}

/** `false` só quando o DNS afirma que o domínio não recebe e-mail. */
export async function dominioRecebeEmail(dominio: string): Promise<boolean> {
  const mx = await temRegistro(dominio, "MX");
  if (mx !== false) return true; // tem MX, ou ninguém respondeu

  const [ipv4, ipv6] = await Promise.all([temRegistro(dominio, "A"), temRegistro(dominio, "AAAA")]);
  return ipv4 !== false || ipv6 !== false;
}
