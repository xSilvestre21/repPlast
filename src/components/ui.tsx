import Link from "next/link";
import { ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

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
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  icone?: LucideIcon;
}) {
  return (
    <header className="mb-7 surgir">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icone && <Placa icone={icone} tom="neutro" pequena />}
            {/*
              O título é grande e o tracking é negativo. Numa geométrica os dois
              andam juntos: sem apertar, a caixa alta abre buracos entre as
              letras e o título de 40px lê como um letreiro.
            */}
            <h1 className="text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.03em] leading-[1.05]">
              {titulo}
            </h1>
          </div>
          {descricao && (
            <p className="text-[0.9375rem] text-tinta-2 mt-2.5 max-w-2xl leading-relaxed">
              {descricao}
            </p>
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
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-tinta">
            {titulo}
          </h2>
        </div>
        {descricao && (
          <p className="text-sm text-tinta-2 mt-2 leading-relaxed">{descricao}</p>
        )}
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
      <div className="flex items-center gap-2.5">
        {icone && <Placa icone={icone} tom={tom} pequena />}
        <span className="rotulo">{rotulo}</span>
      </div>

      <div className="mt-auto">
        <div className="cifra text-[1.75rem] sm:text-[2rem] leading-none">{valor}</div>
        {detalhe && (
          <div className="text-[0.8125rem] text-tinta-2 mt-2.5 leading-relaxed">{detalhe}</div>
        )}
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
export function FaixaMetricas({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-3 items-stretch">{children}</div>;
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
}: {
  children: ReactNode;
  icone?: LucideIcon;
}) {
  return (
    <Cartao className="px-6 py-14 text-center text-sm text-tinta-2">
      <div className="flex flex-col items-center gap-4">
        {icone && <Placa icone={icone} tom="neutro" />}
        <div className="max-w-sm leading-relaxed">{children}</div>
      </div>
    </Cartao>
  );
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
const CLASSE_CONTROLE =
  "w-full bg-folha-2 px-3.5 py-2.5 text-sm text-tinta " +
  "border border-transparent rounded-suave " +
  "placeholder:text-tinta-3 outline-none " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "hover:border-filete " +
  "focus:bg-folha focus:border-carimbo focus:ring-4 focus:ring-carimbo-fraco " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

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
      <span className="rotulo block mb-1.5 text-tinta-2">{rotulo}</span>
      <div className="relative">
        <input
          {...props}
          aria-invalid={erro ? true : undefined}
          className={`${CLASSE_CONTROLE} ${sufixo ? "pr-11" : ""} ${
            erro ? "border-perigo bg-perigo-fraco" : ""
          } ${props.type === "number" ? "numerico" : ""}`}
        />
        {sufixo && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-tinta-3 pointer-events-none">
            {sufixo}
          </span>
        )}
      </div>
      {erro ? (
        <span className="block text-xs text-perigo mt-1.5">{erro}</span>
      ) : (
        dica && <span className="block text-xs text-tinta-3 mt-1.5">{dica}</span>
      )}
    </label>
  );
}

export function Selecao({
  rotulo,
  dica,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { rotulo: string; dica?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo block mb-1.5 text-tinta-2">{rotulo}</span>
      <select {...props} className={CLASSE_CONTROLE}>
        {children}
      </select>
      {dica && <span className="block text-xs text-tinta-3 mt-1.5">{dica}</span>}
    </label>
  );
}

export function AreaTexto({
  className = "",
  ...props
}: ComponentProps<"textarea"> & { className?: string }) {
  return (
    <textarea {...props} className={`${CLASSE_CONTROLE} resize-y ${className}`} />
  );
}

export function MensagemErro({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="surgir rounded-suave border border-perigo/25 bg-perigo-fraco px-4 py-3 text-sm text-perigo"
    >
      {children}
    </p>
  );
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

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm cursor-pointer " +
  "transition-all duration-200 ease-out whitespace-nowrap " +
  "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0";

export function Botao({
  variante = "primaria",
  className = "",
  icone: Glifo,
  carregando = false,
  children,
  ...props
}: ComponentProps<"button"> & {
  variante?: Variante;
  icone?: LucideIcon;
  /** Mostra o giro e trava o botão — evita o clique duplo que cria dois registros. */
  carregando?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      aria-busy={carregando || undefined}
      className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`}
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
  className = "",
  icone: Glifo,
  children,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; icone?: LucideIcon }) {
  return (
    <Link {...props} className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`}>
      {Glifo && <Glifo size={15} strokeWidth={2.25} aria-hidden="true" />}
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
      className={`text-xs font-medium text-tinta-3 underline underline-offset-2 decoration-filete-forte
        transition-colors px-0.5 cursor-pointer disabled:opacity-50 ${
          perigoso ? "hover:text-perigo" : "hover:text-carimbo"
        } ${className}`}
    />
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
