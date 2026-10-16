/**
 * Quem responde pelos dados (LGPD, art. 9º, II e III) e a versão dos textos
 * que a pessoa aceita no cadastro. Num lugar só, para os Termos de Uso, a
 * Política de Privacidade e o cadastro nunca dizerem coisas diferentes.
 *
 * O controlador é pessoa física enquanto o RepPlast não tiver CNPJ. Quando
 * tiver, troque `nome` pela razão social, acrescente o CNPJ aos textos e suba
 * a `VERSAO_TERMOS`.
 *
 * O CPF do controlador não aparece nas páginas nem mora no código: a lei pede
 * identificação e um canal de contato, e nome mais e-mail bastam — CPF inteiro
 * em página pública é matéria-prima de golpe, e no repositório fica para
 * sempre no histórico.
 */
export const CONTROLADOR = {
  nome: "Gustavo Silvestre Costa Lima",
  /** Canal dos pedidos do titular (art. 18) e do encarregado (art. 41). */
  email: "repplast.administrativo@gmail.com",
} as const;

/**
 * A versão dos textos aceitos, gravada junto com o aceite de cada pessoa.
 * Mudou o que os textos dizem? Suba a data: é ela que prova o que foi aceito.
 */
export const VERSAO_TERMOS = "2026-10-16";

/** "16 de outubro de 2026" — a data de vigência que as páginas mostram. */
export const VIGENCIA_TERMOS = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${VERSAO_TERMOS}T00:00:00Z`));
