/**
 * A busca das listas, lembrada enquanto a pessoa está na seção.
 *
 * Para reajustar os produtos de uma indústria, a representante busca a
 * indústria, abre um produto, edita, salva — e voltava para a lista vazia: o
 * "Voltar para Produtos" e o "Salvar e voltar" levam a `/produtos` sem nada, e
 * ela redigitava a busca a cada produto.
 *
 * Em vez de remendar cada link de volta e cada `redirect`, a lista grava a
 * busca (a query que ela já põe na URL) num cookie da seção; a página aberta
 * SEM filtro na URL usa o cookie (`busca-lembrada-servidor.ts`); e
 * `EsquecerBuscas`, no layout, apaga o cookie das outras seções quando a
 * pessoa troca de aba. Cookie sem validade: some ao fechar o navegador.
 *
 * Módulo puro: as funções de cookie só rodam no navegador (`document`), e as
 * outras servem aos dois lados.
 */

export const SECOES_COM_BUSCA = ["produtos", "clientes", "fornecedores", "pedidos", "orcamentos"] as const;

export type SecaoComBusca = (typeof SECOES_COM_BUSCA)[number];

export function nomeDoCookie(secao: SecaoComBusca): string {
  return `repplast_busca_${secao}`;
}

/** "/produtos/abc?editar=1" → "produtos"; fora das listas, `null`. */
export function secaoDoCaminho(caminho: string): SecaoComBusca | null {
  const primeiro = caminho.split(/[?#]/)[0].split("/").filter(Boolean)[0];
  return SECOES_COM_BUSCA.find((secao) => secao === primeiro) ?? null;
}

function gravar(secao: SecaoComBusca, consulta: string) {
  // Sem `max-age`: cookie de sessão, esquecido ao fechar o navegador.
  document.cookie = `${nomeDoCookie(secao)}=${encodeURIComponent(consulta)}; path=/; SameSite=Lax`;
}

function apagar(secao: SecaoComBusca) {
  document.cookie = `${nomeDoCookie(secao)}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Lembra a busca da lista em `url` ("/produtos?busca=vega"). Sem query — a
 * pessoa limpou os filtros —, esquece.
 */
export function lembrarBusca(url: string): void {
  const secao = secaoDoCaminho(url);
  if (!secao) return;

  const consulta = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  if (consulta) gravar(secao, consulta);
  else apagar(secao);
}

/** Esquece a busca de toda seção que não seja `atual` — `null` esquece todas. */
export function esquecerOutras(atual: SecaoComBusca | null): void {
  for (const secao of SECOES_COM_BUSCA) {
    if (secao !== atual && document.cookie.includes(`${nomeDoCookie(secao)}=`)) apagar(secao);
  }
}
