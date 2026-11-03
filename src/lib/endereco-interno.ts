/**
 * O IP é da rede interna — da própria máquina, da rede privada ou do serviço
 * de metadados da nuvem (169.254.169.254)?
 *
 * É o que impede o teste da caixa de e-mail (Configurações) de virar um
 * scanner da rede do servidor: o host e a porta vêm do formulário, e cada erro
 * de conexão volta com uma frase diferente — o bastante para descobrir o que
 * responde lá dentro. Ver `email.ts`.
 */

import { isIP } from "node:net";

function ipv4Interno(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "esta rede"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT, usado dentro de nuvens
    (a === 169 && b === 254) || // link-local: o serviço de metadados mora aqui
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast e reservados
  );
}

export function enderecoInterno(ip: string): boolean {
  const versao = isIP(ip);
  if (versao === 4) return ipv4Interno(ip);
  if (versao !== 6) return true; // não é IP: na dúvida, recusa

  const minusculo = ip.toLowerCase();
  // IPv4 escrito como IPv6 (::ffff:10.0.0.1): vale o IPv4 de dentro.
  const mapeado = minusculo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ipv4Interno(mapeado[1]);

  return (
    minusculo === "::" ||
    minusculo === "::1" ||
    /^f[cd]/.test(minusculo) || // fc00::/7, rede privada
    /^fe[89ab]/.test(minusculo) // fe80::/10, link-local
  );
}
