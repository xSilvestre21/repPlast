/**
 * Como um erro sai de uma Server Action e chega à tela.
 *
 * Três regras, nascidas de uma varredura que achou o sistema inteiro
 * respondendo com um alerta vermelho no TOPO do formulário — enquanto o campo
 * errado ficava no pé da página, e a pessoa clicava em Salvar sem ver nada:
 *
 *   1. O erro diz DE QUAL CAMPO ele é (`campo`, o `name` do input). A tela
 *      mostra a frase logo embaixo dele e leva a pessoa até lá.
 *   2. O que a pessoa digitou volta junto (`valores`). O React 19 limpa o
 *      formulário depois de cada envio; sem isto, errar um campo apagava todos.
 *   3. Erro que NÃO foi escrito para o usuário nunca chega a ele. Texto do
 *      Prisma, do Postgres, do servidor de e-mail ou da configuração vai para o
 *      log; na tela entra uma frase que diz o que fazer.
 *
 * Sem `server-only`: o tipo do estado e as classes são lidos pelos dois lados.
 */

/** O que uma ação de formulário devolve. Vazio é "deu certo". */
export type EstadoFormulario = {
  erro?: string;
  /** `name` do campo que o erro aponta. Linha de tabela: `email#2`. */
  campo?: string;
  /** O que foi digitado, para o formulário voltar preenchido. */
  valores?: Record<string, string>;
};

/** Erro ligado a um campo do formulário. A mensagem é para o usuário. */
export class ErroDeCampo extends Error {
  constructor(
    readonly campo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDeCampo";
  }
}

/** Erro que não é de um campo só, mas foi escrito para o usuário ler. */
export class ErroParaUsuario extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroParaUsuario";
  }
}

/** O nome de campo de uma linha de tabela: `campoDaLinha("email", 2)` → `email#2`. */
export function campoDaLinha(nome: string, indice: number): string {
  return `${nome}#${indice}`;
}

/** Campos que NUNCA voltam para o navegador, em formulário nenhum. */
const NUNCA_DEVOLVER = /senha/i;

/**
 * O que foi digitado, pronto para voltar ao formulário.
 *
 * Só texto: arquivo não volta (o navegador nem deixa repor um `<input
 * type="file">`), e senha também não — ela atravessaria a rede de novo à toa.
 * Campo repetido (linhas de tabela) volta numerado, como em `campoDaLinha`.
 */
export function valoresDigitados(
  formData: FormData,
  { sem = [] }: { sem?: string[] } = {},
): Record<string, string> {
  const valores: Record<string, string> = {};
  const vistos = new Map<string, number>();

  for (const [nome, valor] of formData.entries()) {
    if (typeof valor !== "string") continue;
    if (nome.startsWith("$ACTION") || NUNCA_DEVOLVER.test(nome) || sem.includes(nome)) continue;

    const indice = vistos.get(nome) ?? 0;
    vistos.set(nome, indice + 1);

    // O primeiro guarda o nome puro também: é por ele que o campo único se acha.
    if (indice === 0) valores[nome] = valor;
    valores[campoDaLinha(nome, indice)] = valor;
  }
  return valores;
}

/**
 * Todos os valores digitados de um campo que se repete — as caixas marcadas
 * de uma lista de checkboxes, por exemplo. `undefined` quando o estado não
 * trouxe o que foi digitado (não houve erro): aí vale o que está gravado.
 */
export function valoresDaLista(estado: EstadoFormulario | undefined, nome: string) {
  if (!estado?.erro || !estado.valores) return undefined;
  const prefixo = `${nome}#`;
  return Object.entries(estado.valores)
    .filter(([chave]) => chave.startsWith(prefixo))
    .map(([, valor]) => valor);
}

/** Código de erro do Prisma ("P2002"), sem importar o cliente gerado. */
function codigoPrisma(erro: unknown): string | null {
  if (typeof erro !== "object" || erro === null || !("code" in erro)) return null;
  const { code } = erro as { code: unknown };
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null;
}

const GENERICO =
  "Não conseguimos concluir agora. Confira a internet e tente de novo em instantes; " +
  "se continuar, fale com o suporte.";

/**
 * Converte qualquer erro na resposta da ação — o `catch` de todas elas.
 *
 * `formData`, quando passado, devolve o que foi digitado. O `catch` antigo
 * (`erro.message` direto na tela) mostrava "Unique constraint failed on the
 * fields" e "new row violates row-level security policy" para quem só queria
 * salvar um cliente.
 */
export function falhou(
  erro: unknown,
  formData?: FormData,
  opcoes?: { sem?: string[] },
): EstadoFormulario {
  const valores = formData ? valoresDigitados(formData, opcoes) : undefined;

  if (erro instanceof ErroDeCampo) return { erro: erro.message, campo: erro.campo, valores };
  if (erro instanceof ErroParaUsuario) return { erro: erro.message, valores };

  switch (codigoPrisma(erro)) {
    case "P2002":
      return {
        erro: "Já existe um cadastro com esses mesmos dados. Confira se ele não foi salvo antes.",
        valores,
      };
    case "P2003":
    case "P2025":
      return {
        erro:
          "Algo que este cadastro usa foi apagado ou alterado em outra tela. " +
          "Recarregue a página e tente de novo.",
        valores,
      };
  }

  console.error(erro);
  return { erro: GENERICO, valores };
}

/**
 * O erro que a tela mostra embaixo de UM campo: só o que aponta para ele.
 * Um erro sem `campo` é geral, e vai para perto do botão de enviar.
 */
export function erroDoCampo(estado: EstadoFormulario | undefined, nome: string | undefined) {
  if (!estado?.erro || !nome || estado.campo !== nome) return undefined;
  return estado.erro;
}
