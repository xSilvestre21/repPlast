/**
 * O endereço de um CEP, pelo ViaCEP (https://viacep.com.br) — gratuito, sem
 * chave e liberado para chamada direto do navegador.
 *
 * Usado nos dois lados do cadastro do escritório: na tela, para preencher o
 * endereço assim que o CEP fica completo; no servidor, para recusar o CEP que
 * não existe (a tela pode ter sido pulada).
 *
 * Três respostas, e a terceira importa: `null` quando o serviço não respondeu.
 * Aí ninguém sabe se o CEP existe, e quem chama deixa a pessoa seguir
 * digitando o endereço à mão — o ViaCEP fora do ar não pode impedir uma
 * assinatura.
 */

export type EnderecoDoCep = {
  /** Vazio no CEP geral de cidade pequena, que vale para a cidade inteira. */
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ResultadoCep = EnderecoDoCep | "inexistente" | null;

const ESPERA_MS = 4000;

/** `cep` só com os 8 dígitos. */
export async function consultarCep(cep: string): Promise<ResultadoCep> {
  if (!/^\d{8}$/.test(cep)) return "inexistente";

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
    // 400 é o formato recusado; o CEP bem formado que não existe volta 200 com `erro`.
    if (resposta.status === 400) return "inexistente";
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as Partial<{
      erro: boolean | string;
      logradouro: string;
      bairro: string;
      localidade: string;
      uf: string;
    }>;
    if (dados.erro) return "inexistente";

    return {
      logradouro: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}
