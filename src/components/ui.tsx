import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/*
 * Peças de "Luz & Superfície".
 *
 * Três regras governam tudo aqui:
 *
 *   1. Separa-se com SUPERFÍCIE, não com traço. O cartão não é desenhado por
 *      uma borda: ele é levantado do fundo pela sombra, e o espaço entre um
 *      cartão e o seguinte é o que agrupa a tela.
 *
 *   2. O preto é quem DECIDE. A ação principal é uma pílula preta sólida —
 *      há no máximo uma por tela, e ela é sempre a coisa que a pessoa veio
 *      fazer ali.
 *
 *   3. A cor das placas de ícone não significa NADA. Ela existe para o olho
 *      separar um item do seguinte numa fila. Quem carrega significado é o
 *      azul (interativo), o verde (alcançado), o vermelho (erro) e o amarelo
 *      (o destaque único da tela) — e esses nunca aparecem numa placa.
 */

/* -------------------------------------------------------------------------- */
/* Ícones                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ícone solto, em traço fino.
 *
 * É o ícone de DENTRO da linha — ao lado de um nome, dentro de um botão. O
 * ícone que anuncia um bloco é outro componente (`Placa`), porque ali ele
 * precisa de peso visual e aqui precisa justamente do contrário: acompanhar o
 * texto sem competir com ele.
 *
 * Sempre decorativo: em toda tela onde aparece, o texto ao lado já diz a mesma
 * coisa.
 */
export function Emblema({
  icone: Glifo,
  tom = "tinta",
  className = "",
}: {
  icone: LucideIcon;
  tom?: "tinta" | "carimbo" | "verde" | "fraco";
  className?: string;
}) {
  const TONS = {
    tinta: "text-tinta",
    carimbo: "text-carimbo",
    verde: "text-verde",
    fraco: "text-tinta-3",
  };

  return (
    <Glifo
      aria-hidden="true"
      size={18}
      strokeWidth={1.75}
      className={`shrink-0 ${TONS[tom]} ${className}`}
    />
  );
}

/** As cores de placa disponíveis. Nenhuma delas quer dizer nada. */
type TomPlaca = "sol" | "mar" | "menta" | "pessego" | "lilas" | "neutro";

/**
 * Placa de ícone: o quadrado de cor lavada que anuncia um bloco.
 *
 * Ela é o que dá ritmo a uma fila de seções — três cartões seguidos com placas
 * de cores diferentes se contam de relance, e com o mesmo ícone cinza em todos
 * viram um bloco só.
 */
export function Placa({
  icone: Glifo,
  tom = "neutro",
  pequena = false,
  className = "",
}: {
  icone: LucideIcon;
  tom?: TomPlaca;
  pequena?: boolean;
  className?: string;
}) {
  const TONS: Record<TomPlaca, string> = {
    sol: "placa-sol",
    mar: "placa-mar",
    menta: "placa-menta",
    pessego: "placa-pessego",
    lilas: "placa-lilas",
    neutro: "",
  };

  return (
    <span
      aria-hidden="true"
      className={`placa ${TONS[tom]} ${pequena ? "placa-sm" : ""} ${className}`}
    >
      <Glifo size={pequena ? 14 : 17} strokeWidth={1.75} />
    </span>
  );
}

/** Pílula de rótulo: anuncia um bloco sem tomar o lugar do título. */
export function Chip({
  children,
  icone: Glifo,
  className = "",
}: {
  children: ReactNode;
  icone?: LucideIcon;
  className?: string;
}) {
  return (
    <span className={`chip ${className}`}>
      {Glifo && <Glifo size={13} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Estrutura de página                                                        */
/* -------------------------------------------------------------------------- */

export function Cabecalho({
  titulo,
  descricao,
  acao,
  icone,
  selo,
  voltar,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  icone?: LucideIcon;
  /**
   * O caminho de volta, escrito por extenso.
   *
   * A barra do topo já leva para a lista, mas ela é um menu: quem não tem
   * costume de computador não lê aquilo como "sair daqui". A seta com o nome
   * do destino diz as duas coisas — que dá para voltar e para onde.
   */
  voltar?: { href: string; rotulo: string };
  /**
   * O estado do documento, ao lado do título.
   *
   * Existe porque a ficha do pedido precisava dele e, por não existir, foi a
   * única das vinte e duas telas a escrever o próprio cabeçalho — com outro
   * tamanho, outro peso, outra margem e sem a animação de entrada.
   */
  selo?: ReactNode;
}) {
  return (
    <header className="mb-7 surgir">
      {voltar && (
        <Link
          href={voltar.href}
          className="inline-flex items-center gap-1.5 mb-3 text-corpo text-tinta-2
            transition-colors hover:text-carimbo"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Voltar para {voltar.rotulo}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-3">
            {icone && <Placa icone={icone} tom="neutro" pequena />}
            {/*
              `text-titulo` é um clamp(): cresce com a largura em vez de saltar
              no breakpoint, e já traz a entrelinha e o tracking negativo. Numa
              geométrica os dois andam juntos — sem apertar, o título de 40px
              abre buracos entre as letras e lê como letreiro.
            */}
            <h1 className="text-titulo font-bold text-balance">{titulo}</h1>
            {selo}
          </div>
          {descricao && (
            <p className="text-realce text-tinta-2 mt-2.5 max-w-2xl">{descricao}</p>
          )}
        </div>
        {acao}
      </div>
    </header>
  );
}

export function Cartao({
  children,
  className = "",
  marcada = false,
}: {
  children: ReactNode;
  className?: string;
  /** A folha principal da tela: canto maior, sombra alta, lavada de luz. */
  marcada?: boolean;
}) {
  return (
    <div className={`folha ${marcada ? "folha-marcada" : ""} ${className}`}>{children}</div>
  );
}

export function SecaoCartao({
  titulo,
  descricao,
  icone,
  tom = "neutro",
  children,
}: {
  titulo: string;
  descricao?: string;
  icone?: LucideIcon;
  tom?: TomPlaca;
  children: ReactNode;
}) {
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="mb-5">
        <div className="titulo-regra">
          {icone && <Placa icone={icone} tom={tom} pequena />}
          <h2 className="text-realce font-semibold text-tinta">{titulo}</h2>
        </div>
        {descricao && <p className="text-corpo text-tinta-2 mt-2">{descricao}</p>}
      </div>
      {children}
    </Cartao>
  );
}

/**
 * Indicador: placa e rótulo em cima, número grande embaixo.
 *
 * Cada um é um cartão INTEIRO, e não uma coluna dentro de um. O cartão
 * separado é o que permite a ele subir sozinho quando o ponteiro passa, e é
 * assim que a pessoa descobre quais dos três levam a algum lugar.
 */
export function CartaoMetrica({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "neutro",
  href,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: LucideIcon;
  tom?: TomPlaca;
  href?: string;
}) {
  const conteudo = (
    <div className="px-5 py-5 h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {icone && <Placa icone={icone} tom={tom} pequena />}
        <span className="rotulo">{rotulo}</span>
      </div>

      <div className="mt-auto">
        <div className="cifra text-cifra">{valor}</div>
        {detalhe && <div className="text-rotulo text-tinta-2 mt-2.5">{detalhe}</div>}
      </div>
    </div>
  );

  if (!href) return <Cartao className="h-full">{conteudo}</Cartao>;

  return (
    <Link href={href} className="block h-full group">
      <Cartao className="h-full elevavel">{conteudo}</Cartao>
    </Link>
  );
}

/**
 * Faixa de indicadores.
 *
 * Grade de cartões soltos, separados por espaço. O filete vertical que os
 * dividia saiu junto com o papel: aqui quem agrupa é o intervalo igual entre
 * eles, e quem separa é o ar em volta de cada um.
 */
export function FaixaMetricas({
  children,
  colunas = 3,
}: {
  children: ReactNode;
  colunas?: 2 | 3 | 4;
}) {
  /*
   * As classes são escritas por extenso porque o Tailwind lê o código-fonte:
   * `sm:grid-cols-${colunas}` não existiria em lugar nenhum para ele encontrar,
   * e a grade sairia com uma coluna só.
   *
   * Três e quatro colunas nascem em `md:`, não em `sm:` — a 640px elas ficam
   * com pouco mais de 150px cada, e a cifra quebra no meio.
   */
  const GRADES = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 md:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  } as const;

  return <div className={`grid gap-4 items-stretch ${GRADES[colunas]}`}>{children}</div>;
}

/**
 * Linha de lista clicável.
 *
 * A seta desliza para dentro no hover e fica meio apagada em repouso — é o que
 * diz que a linha leva a algum lugar, inclusive no celular, onde não há hover
 * para revelar nada.
 */
export function LinhaLista({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group realcavel relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 pr-10 ${className}`}
    >
      {children}
      <ChevronRight
        aria-hidden="true"
        size={16}
        strokeWidth={2}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tinta-3
          opacity-0 -translate-x-1.5 transition-all duration-200
          group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-carimbo"
      />
    </Link>
  );
}

export function EstadoVazio({
  children,
  icone,
  titulo,
  acao,
  discreto = false,
}: {
  children: ReactNode;
  icone?: LucideIcon;
  titulo?: string;
  /** O caminho para sair do vazio. Sem ele a tela só informa, e não resolve. */
  acao?: ReactNode;
  /** Dentro de um cartão que já existe: sem casca própria e sem tanto ar. */
  discreto?: boolean;
}) {
  const conteudo = (
    <div
      className={`flex flex-col items-center gap-4 text-center text-corpo text-tinta-2 ${
        discreto ? "py-8 px-4" : ""
      }`}
    >
      {icone && <Placa icone={icone} tom="neutro" pequena={discreto} />}
      <div className="max-w-sm">
        {titulo && <p className="text-realce font-semibold text-tinta mb-1.5">{titulo}</p>}
        {children}
      </div>
      {acao}
    </div>
  );

  if (discreto) return conteudo;

  return <Cartao className="px-6 py-14">{conteudo}</Cartao>;
}

/* -------------------------------------------------------------------------- */
/* Formulário                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Campo com caixa preenchida.
 *
 * O fundo cinza é o que diz "escreva aqui" antes de a pessoa clicar — num
 * formulário de vinte campos, o filete embaixo dependia da pessoa já saber
 * onde era o campo. Ao focar, o fundo some, a borda vira azul e o anel abre:
 * o campo ativo é o único elemento branco da coluna.
 */
/**
 * A caixa de um controle de formulário.
 *
 * Exportada para as poucas telas que precisam de um campo SEM rótulo em cima —
 * uma linha de tabela editável, onde o cabeçalho da coluna já diz o que é e um
 * rótulo por célula viraria ruído. Fora esses casos, use `Campo`.
 */
const CONTROLE_BASE =
  "bg-folha-2 text-tinta border border-transparent " +
  "placeholder:text-tinta-3 outline-none " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "hover:border-filete " +
  "focus:bg-folha focus:border-carimbo focus:ring-4 focus:ring-carimbo-fraco " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const CLASSE_CONTROLE = `w-full px-3.5 py-2.5 text-corpo rounded-suave ${CONTROLE_BASE}`;

/**
 * O mesmo controle, do tamanho de uma célula de tabela.
 *
 * A tabela de itens tinha um campo próprio: raio de 4px, padding menor e
 * `focus:border-carimbo` sem o anel. Eram os campos mais usados do produto —
 * quantidade e preço, doze vezes por pedido — e os únicos em que o teclado não
 * mostrava onde estava. O que muda aqui é a medida, nunca o foco.
 */
export const CLASSE_CONTROLE_CELULA = `px-2 py-1 text-corpo rounded-miudo ${CONTROLE_BASE}`;

/*
 * Rótulo e rodapé são os mesmos nos três controles.
 *
 * Antes não eram: `Campo` tinha rótulo, dica e erro; `Selecao` tinha rótulo e
 * dica; `AreaTexto` não tinha nada, e cada tela montava o `<label>` na mão com
 * um espaçamento diferente. Era metade do "formulário bagunçado".
 */
function Rotulo({ children }: { children: ReactNode }) {
  return <span className="rotulo block mb-1.5 text-tinta-2">{children}</span>;
}

/** Erro OU dica, nunca os dois: com erro, a dica já não é o que importa. */
function RodapeCampo({ erro, dica }: { erro?: string; dica?: string }) {
  if (erro) return <span className="block text-mini text-perigo mt-1.5">{erro}</span>;
  if (dica) return <span className="block text-mini text-tinta-3 mt-1.5">{dica}</span>;
  return null;
}

/** A borda e o fundo que um controle ganha quando o valor dele não serve. */
const CLASSE_ERRO = "border-perigo bg-perigo-fraco";

export function Campo({
  rotulo,
  dica,
  erro,
  sufixo,
  className = "",
  ...props
}: ComponentProps<"input"> & {
  rotulo: string;
  dica?: string;
  erro?: string;
  sufixo?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      <div className="relative">
        <input
          {...props}
          aria-invalid={erro ? true : undefined}
          className={`${CLASSE_CONTROLE} ${sufixo ? "pr-11" : ""} ${erro ? CLASSE_ERRO : ""} ${
            props.type === "number" ? "numerico text-right" : ""
          }`}
        />
        {sufixo && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mini text-tinta-3 pointer-events-none">
            {sufixo}
          </span>
        )}
      </div>
      <RodapeCampo erro={erro} dica={dica} />
    </label>
  );
}

export function Selecao({
  rotulo,
  dica,
  erro,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { rotulo: string; dica?: string; erro?: string }) {
  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      <select
        {...props}
        aria-invalid={erro ? true : undefined}
        className={`${CLASSE_CONTROLE} ${erro ? CLASSE_ERRO : ""} appearance-none pr-9 bg-[position:right_0.75rem_center] bg-no-repeat bg-[length:0.65rem] bg-[image:var(--seta-selecao)]`}
      >
        {children}
      </select>
      <RodapeCampo erro={erro} dica={dica} />
    </label>
  );
}

/**
 * Área de texto.
 *
 * `rotulo` é opcional aqui, ao contrário de `Campo`: a caixa de condições da
 * proposta ocupa a linha inteira debaixo de um título de seção que já diz o
 * que ela é, e um rótulo em cima seria a mesma palavra duas vezes.
 */
export function AreaTexto({
  rotulo,
  dica,
  erro,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { rotulo?: string; dica?: string; erro?: string }) {
  const caixa = (
    <textarea
      {...props}
      aria-invalid={erro ? true : undefined}
      className={`${CLASSE_CONTROLE} resize-y ${erro ? CLASSE_ERRO : ""} ${
        rotulo ? "" : className
      }`}
    />
  );

  if (!rotulo) {
    if (!erro && !dica) return caixa;
    return (
      <div className={className}>
        {caixa}
        <RodapeCampo erro={erro} dica={dica} />
      </div>
    );
  }

  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      {caixa}
      <RodapeCampo erro={erro} dica={dica} />
    </label>
  );
}

/**
 * O recado depois de uma ação.
 *
 * O verde existia — escrito à mão numa tela só, com um padding diferente do
 * vermelho e sem `role`, de modo que quem usa leitor de tela era avisado do
 * erro e não do sucesso.
 *
 * `alert` interrompe a leitura; `status` espera a frase terminar. É a diferença
 * certa: "não deu" precisa chegar agora, "deu certo" pode esperar dois segundos.
 */
export function Mensagem({
  children,
  tom = "perigo",
}: {
  children?: ReactNode;
  tom?: "perigo" | "verde";
}) {
  if (!children) return null;

  const TONS = {
    perigo: "border-perigo/25 bg-perigo-fraco text-perigo",
    verde: "border-verde/25 bg-verde-fraco text-verde",
  };

  return (
    <p
      role={tom === "perigo" ? "alert" : "status"}
      className={`surgir rounded-suave border px-4 py-3 text-corpo ${TONS[tom]}`}
    >
      {children}
    </p>
  );
}

/** Atalho para o caso comum. Dezoito telas o chamam. */
export function MensagemErro({ children }: { children?: ReactNode }) {
  return <Mensagem tom="perigo">{children}</Mensagem>;
}

/* -------------------------------------------------------------------------- */
/* Ações                                                                      */
/* -------------------------------------------------------------------------- */

type Variante = "primaria" | "secundaria" | "perigo";

const VARIANTES: Record<Variante, string> = {
  // A pílula preta. Uma por tela, e é sempre o que a pessoa veio fazer ali.
  primaria:
    "bg-tinta text-papel font-semibold shadow-[var(--sombra)] " +
    "hover:-translate-y-0.5 hover:shadow-[var(--sombra-alta)] active:translate-y-0",
  secundaria:
    "bg-folha text-tinta font-medium border border-filete shadow-[var(--sombra-sm)] " +
    "hover:bg-folha-2 hover:border-filete-forte",
  // Contorno, nunca preenchimento: vermelho cheio num botão que apaga coisas
  // convida ao clique justamente onde o clique custa caro.
  perigo: "border border-perigo/40 text-perigo font-medium hover:bg-perigo-fraco",
};

/*
 * Dois tamanhos, e só dois.
 *
 * O `compacto` existe porque seis telas já sobrescreviam o padding do botão à
 * mão — com dois valores diferentes entre elas, e um sétimo no painel. Onde a
 * ação mora dentro de um cartão pequeno ou de uma linha de lista, o botão de
 * `py-2.5` empurra tudo; é esse o caso, e não outro.
 */
type Tamanho = "normal" | "compacto";

const TAMANHOS: Record<Tamanho, string> = {
  normal: "px-5 py-2.5 text-corpo",
  compacto: "px-4 py-2 text-mini",
};

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full cursor-pointer " +
  "transition-all duration-200 ease-out whitespace-nowrap " +
  "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0";

export function Botao({
  variante = "primaria",
  tamanho = "normal",
  className = "",
  icone: Glifo,
  carregando = false,
  children,
  ...props
}: ComponentProps<"button"> & {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: LucideIcon;
  /** Mostra o giro e trava o botão — evita o clique duplo que cria dois registros. */
  carregando?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      aria-busy={carregando || undefined}
      className={`${CLASSE_BOTAO} ${TAMANHOS[tamanho]} ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? (
        <Loader2 size={15} strokeWidth={2.25} className="animate-spin" aria-hidden="true" />
      ) : (
        Glifo && <Glifo size={15} strokeWidth={2.25} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function BotaoLink({
  variante = "primaria",
  tamanho = "normal",
  className = "",
  icone: Glifo,
  carregando = false,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: LucideIcon;
  /*
   * Um link não "submete", mas navega — e numa lista grande a página seguinte
   * demora o bastante para a pessoa clicar de novo. O giro aqui é a mesma
   * promessa que no botão: já ouvi, está vindo.
   */
  carregando?: boolean;
}) {
  return (
    <Link
      {...props}
      aria-busy={carregando || undefined}
      className={`${CLASSE_BOTAO} ${TAMANHOS[tamanho]} ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? (
        <Loader2 size={15} strokeWidth={2.25} className="animate-spin" aria-hidden="true" />
      ) : (
        Glifo && <Glifo size={15} strokeWidth={2.25} aria-hidden="true" />
      )}
      {children}
    </Link>
  );
}

/** Ação discreta dentro de uma linha de tabela ou lista. */
export function BotaoTexto({
  perigoso = false,
  className = "",
  ...props
}: ComponentProps<"button"> & { perigoso?: boolean }) {
  return (
    <button
      {...props}
      className={`text-mini font-medium text-tinta-3 underline underline-offset-2 decoration-filete-forte
        transition-colors px-0.5 cursor-pointer disabled:opacity-50 ${
          perigoso ? "hover:text-perigo" : "hover:text-carimbo"
        } ${className}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Listas e tabelas                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A caixa de uma lista DENTRO de um cartão.
 *
 * Existiam cinco receitas para isto — dois raios crus, dois fundos, e um deles
 * apontando para um token que já não existia, de modo que três telas exibiam
 * uma caixa sem fundo nenhum e ninguém tinha reparado.
 *
 * Ela é recuada, não levantada: já está sobre uma superfície, e uma sombra aqui
 * criaria um cartão dentro do cartão.
 */
export function Painel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-suave border border-filete bg-folha-2 divide-y divide-filete overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Linha de lista que NÃO navega.
 *
 * Irmã de `LinhaLista`, com o mesmo espaçamento e sem a seta — é a diferença
 * entre "isto leva a algum lugar" e "isto é um dado com ações próprias". Antes
 * dela, cada tela sem navegação inventava o seu padding.
 */
export function LinhaDado({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 ${className}`}>
      {children}
    </div>
  );
}

/**
 * O miolo de uma linha: o que ela é, e o que vale saber sem abrir.
 *
 * `min-w-0` é o que faz o `truncate` funcionar dentro de um flex — sem ele o
 * item se recusa a encolher e empurra o valor para fora da linha.
 */
export function CorpoLinha({
  titulo,
  detalhe,
  className = "",
}: {
  titulo: ReactNode;
  detalhe?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex-1 ${className}`}>
      <div className="text-corpo font-medium text-tinta truncate">{titulo}</div>
      {detalhe && <div className="text-mini text-tinta-3 mt-0.5 truncate">{detalhe}</div>}
    </div>
  );
}

/**
 * O valor de uma linha de lista, à direita.
 *
 * É o contrato que faltava. Metade das listas alinhava o número à direita e
 * metade não — e as duas que não alinhavam eram Pedidos e Orçamentos, onde o
 * total em reais muda de posição a cada linha justamente na tela em que se
 * comparam valores. Com `.numerico` os dígitos têm largura fixa, então a
 * vírgula cai sempre na mesma coluna.
 */
export function ValorLinha({
  valor,
  nota,
  riscado = false,
  className = "",
}: {
  valor: ReactNode;
  nota?: ReactNode;
  /** O valor de um documento que deixou de valer: cancelado, recusado. */
  riscado?: boolean;
  className?: string;
}) {
  return (
    <div className={`text-right shrink-0 ${className}`}>
      <div
        className={`text-corpo numerico ${
          riscado ? "text-tinta-3 line-through" : "font-semibold text-tinta"
        }`}
      >
        {valor}
      </div>
      {nota && <div className="text-mini text-tinta-3 numerico mt-0.5">{nota}</div>}
    </div>
  );
}

/**
 * O fim de uma linha de lista: o valor e o estado, sempre nesta ordem.
 *
 * As larguras são fixas de propósito. É o que faz a coluna de reais cair no
 * mesmo x em Pedidos, Orçamentos, Clientes e Produtos — e o selo começar no
 * mesmo x também, em vez de dançar conforme o tamanho do número ao lado.
 *
 * `basis-full sm:basis-auto` deixa o bloco descer para a segunda linha no
 * celular, onde não cabe ao lado do nome do cliente.
 */
export function FimDaLinha({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-4 basis-full sm:basis-auto sm:ml-auto shrink-0">
      {children}
    </div>
  );
}

/** Como uma coluna se comporta. É daqui que sai o alinhamento do número. */
export type Alinhamento = "texto" | "numero" | "acao";

const ALINHAMENTO: Record<Alinhamento, string> = {
  texto: "text-left",
  numero: "text-right numerico",
  acao: "text-right",
};

export type ColunaTabela = {
  rotulo: ReactNode;
  alinhamento?: Alinhamento;
  /** Classe de largura, quando a coluna não pode encolher (`w-32`, `w-20`…). */
  largura?: string;
};

/**
 * Tabela, com o cabeçalho tirado da mesma fonte que as células.
 *
 * O ponto não é a casca: é o `alinhamento` viver na definição da coluna. Onde
 * o `<th>` e o `<td>` decidiam cada um por si, o cabeçalho "VALOR" ficava à
 * esquerda com os números à direita, ou o contrário.
 *
 * `larguraMinima` vai no elemento de dentro e a rolagem no de fora: a tabela
 * rola dentro do próprio contêiner em vez de arrastar a página junto.
 */
export function Tabela({
  colunas,
  children,
  larguraMinima = "min-w-160",
  className = "",
}: {
  colunas: ColunaTabela[];
  children: ReactNode;
  larguraMinima?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto -mx-1 px-1 ${className}`}>
      <table className={`w-full border-collapse text-corpo ${larguraMinima}`}>
        <thead>
          <tr className="border-b border-filete">
            {colunas.map((coluna, indice) => (
              <th
                key={indice}
                scope="col"
                className={`px-3 py-2.5 font-medium text-mini text-tinta-3 ${
                  ALINHAMENTO[coluna.alinhamento ?? "texto"]
                } ${coluna.largura ?? ""}`}
              >
                {coluna.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-filete">{children}</tbody>
      </table>
    </div>
  );
}

export function Celula({
  alinhamento = "texto",
  children,
  className = "",
  ...props
}: ComponentProps<"td"> & { alinhamento?: Alinhamento }) {
  return (
    <td {...props} className={`px-3 py-2.5 align-middle ${ALINHAMENTO[alinhamento]} ${className}`}>
      {children}
    </td>
  );
}

/**
 * Paginação.
 *
 * Aparece só quando há mais de uma página — numa lista curta ela seria uma
 * barra dizendo "1 de 1". Os dois botões são LINKS, não botões de script: a
 * página está na URL, então dá para voltar pelo navegador, abrir em aba nova e
 * mandar o endereço para alguém.
 */
export function Paginacao({
  pagina,
  paginas,
  total,
  href,
  rotuloItem = "item",
}: {
  pagina: number;
  paginas: number;
  total: number;
  /** Monta o endereço de uma página, preservando os demais filtros. */
  href: (pagina: number) => string;
  /** Singular do que está sendo listado: "produto", "pedido". */
  rotuloItem?: string;
}) {
  if (paginas <= 1) return null;

  const CLASSE =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-mini font-medium " +
    "border border-filete bg-folha text-tinta transition-colors hover:bg-folha-2";

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1"
    >
      <span className="text-mini text-tinta-3">
        Página <span className="numerico">{pagina}</span> de{" "}
        <span className="numerico">{paginas}</span> ·{" "}
        <span className="numerico">{total.toLocaleString("pt-BR")}</span> {rotuloItem}
        {total === 1 ? "" : "s"}
      </span>

      <span className="flex items-center gap-2">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={CLASSE} rel="prev">
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          <span className={`${CLASSE} opacity-40`}>
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
            Anterior
          </span>
        )}

        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={CLASSE} rel="next">
            Próxima
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${CLASSE} opacity-40`}>
            Próxima
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </span>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Selos e indicadores                                                        */
/* -------------------------------------------------------------------------- */

export type TomSelo = "neutro" | "verde" | "carimbo" | "perigo" | "cancelado";

/**
 * Pílula de estado.
 *
 * Havia dois arquivos de selo com o mesmo mapa de classes copiado, mais quatro
 * pílulas artesanais espalhadas — duas delas idênticas entre si a não ser pela
 * cor do texto, o que não era decisão, era descuido.
 *
 * O riscado do cancelado não é enfeite: cor sozinha não pode carregar estado, e
 * quem não distingue o cinza do verde ainda vê o risco.
 */
export function Selo({
  children,
  tom = "neutro",
  icone: Glifo,
  className = "",
}: {
  children: ReactNode;
  tom?: TomSelo;
  icone?: LucideIcon;
  className?: string;
}) {
  const TONS: Record<TomSelo, string> = {
    neutro: "carimbo carimbo-apagado",
    verde: "carimbo carimbo-verde",
    // Tom novo entra como classe irmã de `.carimbo`, nunca como utilitária de
    // cor: a base já pinta de verde e vence a utilitária. Ver `globals.css`.
    carimbo: "carimbo carimbo-azul",
    perigo: "carimbo carimbo-perigo",
    cancelado: "carimbo carimbo-apagado line-through decoration-1",
  };

  return (
    <span className={`${TONS[tom]} ${className}`}>
      {Glifo && <Glifo size={12} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Iniciais de um nome, para o avatar.
 *
 * Numa lista de razões sociais parecidas ("MARIOL EMBALAGENS", "MARIPLAST"),
 * duas letras em destaque dão à linha uma âncora visual que o texto corrido
 * não dá.
 *
 * O hífen separa tanto quanto o espaço: "AN-PARAFUSOS" são duas palavras para
 * quem lê, e cortar só no espaço devolveria um "A" solitário. Partículas ficam
 * de fora porque "Val & Amaral" deve dar VA, e não V&.
 *
 * Nome de uma palavra só rende as duas primeiras letras — uma letra sozinha
 * repete demais numa lista e deixa de distinguir qualquer coisa.
 */
export function iniciaisDe(nome: string): string {
  const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "&"]);

  const palavras = nome
    .split(/[\s-]+/)
    .filter((palavra) => palavra.length > 0 && !PARTICULAS.has(palavra.toLowerCase()));

  if (palavras.length === 0) return "?";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();

  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

/** Disco com as iniciais. Três telas o desenhavam, e uma delas sem raio nenhum. */
export function Avatar({
  nome,
  pequeno = false,
  className = "",
}: {
  nome: string;
  pequeno?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center shrink-0 rounded-full border border-filete bg-folha-2
        text-tinta-2 font-semibold ${pequeno ? "size-8 text-micro" : "size-9 text-mini"} ${className}`}
    >
      {iniciaisDe(nome)}
    </span>
  );
}

/**
 * Barra de progresso.
 *
 * O trilho e o preenchimento eram montados à mão, com a animação lendo `--alvo`
 * de um `style` inline. Aqui a conta fica num lugar só, e o `role`/`aria` fazem
 * o número existir para quem não enxerga a barra.
 */
export function Barra({
  progresso,
  tom = "tinta",
  className = "",
}: {
  /** 0 a 100. Acima disso a barra enche e para — ninguém transborda o trilho. */
  progresso: number;
  /** `tinta` é o progresso neutro; `verde` é o que já foi alcançado. */
  tom?: "tinta" | "carimbo" | "verde";
  className?: string;
}) {
  const TONS = { tinta: "bg-tinta", carimbo: "bg-carimbo", verde: "bg-verde" };
  const limitado = Math.max(0, Math.min(100, progresso));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(limitado)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2.5 rounded-full bg-folha-2 overflow-hidden ${className}`}
    >
      {/* Cresce de zero até o valor: o preenchimento mostra o progresso
          acontecendo, não só o resultado. */}
      <div
        className={`h-full rounded-full barra-preenche ${TONS[tom]}`}
        style={{ "--alvo": `${limitado}%` } as CSSProperties}
      />
    </div>
  );
}

/**
 * Controle segmentado: escolher uma entre poucas opções, todas visíveis.
 *
 * Dois desenhos conviviam — um com trilho e pastilha branca, outro sem trilho e
 * com pastilha preta. Ficou o do trilho: a pastilha preta é a ação principal da
 * tela, e gastá-la num filtro tira o preto de onde ele decide.
 *
 * Cada opção é um link ou um botão, conforme o estado morar na URL ou no
 * componente — as duas formas existem no produto e as duas são legítimas.
 */
export function Segmentado<T extends string>({
  opcoes,
  atual,
  nome,
  aoEscolher,
  className = "",
}: {
  opcoes: { valor: T; rotulo: ReactNode; href?: string; desabilitada?: boolean }[];
  atual: T;
  /** Rótulo do grupo, para quem navega por leitor de tela. */
  nome: string;
  aoEscolher?: (valor: T) => void;
  className?: string;
}) {
  const PASTILHA =
    "px-3 py-1 rounded-full text-mini font-semibold cursor-pointer transition-colors duration-200 " +
    "whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";
  const ATIVA = "bg-folha text-tinta shadow-suave";
  const INATIVA = "text-tinta-2 hover:text-tinta";

  return (
    <div
      role="group"
      aria-label={nome}
      className={`inline-flex gap-0.5 p-0.5 rounded-full bg-folha-2 border border-filete ${className}`}
    >
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === atual;
        const classe = `${PASTILHA} ${ativa ? ATIVA : INATIVA}`;

        return opcao.href ? (
          <Link
            key={opcao.valor}
            href={opcao.href}
            aria-current={ativa ? "true" : undefined}
            className={classe}
          >
            {opcao.rotulo}
          </Link>
        ) : (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativa}
            disabled={opcao.desabilitada}
            onClick={() => aoEscolher?.(opcao.valor)}
            className={classe}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Faixa de totais: células coladas, separadas por um fio.
 *
 * Diferente de `FaixaMetricas`, onde cada indicador é um cartão solto. Aqui os
 * números são partes de uma mesma conta — previsto, recebido, a acertar — e o
 * ar entre eles diria que não são. O fio é o fundo aparecendo pelo `gap-px`.
 */
export function GradeTotais({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-filete border border-filete rounded-suave overflow-hidden">
      {children}
    </div>
  );
}

export function Total({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Só onde o número já significa algo por si: o que entrou, o que falta. */
  tom?: "verde" | "perigo";
}) {
  const TONS = { verde: "text-verde", perigo: "text-perigo" };

  return (
    <div className="bg-folha px-4 py-3.5">
      <div className="rotulo">{rotulo}</div>
      <div className={`cifra text-forte mt-1.5 ${tom ? TONS[tom] : "text-tinta"}`}>{valor}</div>
      {detalhe && <div className="text-mini text-tinta-3 mt-1">{detalhe}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Formatação                                                                 */
/* -------------------------------------------------------------------------- */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number | string) {
  return MOEDA.format(Number(valor));
}

export function formatarPercentual(valor: number | string) {
  return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%`;
}
