import Link from "next/link";
import { ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/*
 * Peças de "Papel & Tinta".
 *
 * Duas regras governam tudo aqui:
 *
 *   1. Separa-se com FILETE, não com caixa. Um cartão com sombra em volta de
 *      cada coisa transforma a tela num quadro de avisos; o traço fino faz o
 *      mesmo trabalho e deixa a página respirar como uma folha diagramada.
 *
 *   2. O vermelho é CARIMBO, nunca decoração. Ele marca a aba ativa, o pedido
 *      enviado e o que é destrutivo — três coisas que a pessoa precisa achar
 *      de longe. O botão principal é preto, porque preto é a tinta do texto.
 */

/* -------------------------------------------------------------------------- */
/* Ícones                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ícone de seção, em traço fino e na cor da tinta.
 *
 * Sem placa colorida atrás: o quadradinho tingido é vocabulário de aplicativo,
 * e aqui o vocabulário é de impresso. O ícone é sempre decorativo — em toda
 * tela onde aparece, o texto ao lado já diz a mesma coisa.
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
      strokeWidth={1.5}
      className={`shrink-0 ${TONS[tom]} ${className}`}
    />
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
    <header className="mb-8 surgir">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {icone && <Emblema icone={icone} tom="fraco" className="size-4" />}
            <h1 className="font-serif text-3xl sm:text-[2.375rem] font-medium tracking-tight leading-none">
              {titulo}
            </h1>
          </div>
          {descricao && (
            <p className="text-sm text-tinta-2 mt-2.5 max-w-2xl leading-relaxed">{descricao}</p>
          )}
        </div>
        {acao}
      </div>

      {/* O filete fecha o cabeçalho como a linha sob o título de uma matéria. */}
      <hr className="regra mt-5" />
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
  /** Traço de carimbo na lombada. Só para o bloco principal da tela. */
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
  children,
}: {
  titulo: string;
  descricao?: string;
  icone?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="mb-5">
        <div className="titulo-regra">
          {icone && <Emblema icone={icone} tom="fraco" className="size-4" />}
          <h2 className="rotulo text-tinta">{titulo}</h2>
        </div>
        {descricao && <p className="text-sm text-tinta-2 mt-2">{descricao}</p>}
      </div>
      {children}
    </Cartao>
  );
}

/**
 * Indicador: rótulo em cima, número grande em serifada embaixo.
 *
 * Sem caixa própria — a separação entre um indicador e o seguinte é um filete
 * vertical, do jeito que colunas de um quadro impresso se separam. Quem
 * desenha esse filete é o contêiner (`FaixaMetricas`).
 */
export function CartaoMetrica({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "tinta",
  href,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: LucideIcon;
  tom?: ComponentProps<typeof Emblema>["tom"];
  href?: string;
}) {
  const conteudo = (
    <div className="px-5 py-5 h-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icone && <Emblema icone={icone} tom={tom} className="size-3.5" />}
        <span className="rotulo">{rotulo}</span>
      </div>

      <div>
        <div className="cifra text-2xl sm:text-[1.75rem] leading-none">{valor}</div>
        {detalhe && <div className="text-xs text-tinta-2 mt-2 leading-relaxed">{detalhe}</div>}
      </div>
    </div>
  );

  if (!href) return conteudo;

  return (
    <Link href={href} className="block h-full realcavel group">
      {conteudo}
    </Link>
  );
}

/**
 * Faixa de indicadores separados por filete.
 *
 * O filete vira horizontal quando a faixa empilha no celular — separar
 * colunas com um traço vertical que não existe mais seria mentira.
 */
export function FaixaMetricas({ children }: { children: ReactNode }) {
  return (
    <Cartao className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-filete">
      {children}
    </Cartao>
  );
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
      className={`group realcavel relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 pr-9 ${className}`}
    >
      {children}
      <ChevronRight
        aria-hidden="true"
        size={15}
        strokeWidth={1.5}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-tinta-3
          opacity-0 -translate-x-1 transition-all duration-200
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
    <Cartao className="px-6 py-12 text-center text-sm text-tinta-2">
      <div className="flex flex-col items-center gap-3">
        {icone && <Emblema icone={icone} tom="fraco" className="size-6" />}
        <div className="max-w-sm leading-relaxed">{children}</div>
      </div>
    </Cartao>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulário                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Campo com filete embaixo, e não caixa em volta.
 *
 * É a linha pontilhada do formulário de papel: você escreve EM CIMA dela. Com
 * caixa completa, uma tela de vinte campos vira uma grade de retângulos e o
 * olho perde onde estava.
 */
const CLASSE_CONTROLE =
  "w-full bg-transparent px-0 py-2 text-sm text-tinta " +
  "border-0 border-b border-filete rounded-none " +
  "placeholder:text-tinta-3 outline-none transition-colors duration-150 " +
  "hover:border-filete-forte " +
  "focus:border-carimbo focus:outline-none " +
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
      <span className="rotulo block mb-0.5">{rotulo}</span>
      <div className="relative">
        <input
          {...props}
          aria-invalid={erro ? true : undefined}
          className={`${CLASSE_CONTROLE} ${sufixo ? "pr-10" : ""} ${
            erro ? "border-perigo" : ""
          } ${props.type === "number" ? "numerico" : ""}`}
        />
        {sufixo && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-tinta-3 pointer-events-none">
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
      <span className="rotulo block mb-0.5">{rotulo}</span>
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
    <textarea
      {...props}
      // A área de texto é a exceção: várias linhas sobre um filete só ficariam
      // soltas no papel, então ela ganha caixa inteira.
      className={`w-full bg-folha-2 px-3.5 py-2.5 text-sm text-tinta resize-y
        border border-filete rounded-[3px]
        placeholder:text-tinta-3 outline-none transition-colors duration-150
        hover:border-filete-forte focus:border-carimbo
        disabled:opacity-50 ${className}`}
    />
  );
}

export function MensagemErro({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="surgir border-l-2 border-perigo bg-perigo-fraco px-4 py-3 text-sm text-perigo"
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
  // Preto sólido: preto é a tinta do texto, e a ação principal é escrita com
  // a mesma tinta do resto do documento — só que cheia.
  primaria: "bg-tinta text-papel font-medium hover:opacity-85",
  secundaria: "border border-filete-forte text-tinta hover:bg-folha-2",
  // Contorno, nunca preenchimento: o vermelho cheio é o carimbo de ENVIADO, e
  // dois vermelhos sólidos com significados opostos na mesma tela confundiriam.
  perigo: "border border-perigo/50 text-perigo hover:bg-perigo-fraco",
};

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2 text-sm cursor-pointer " +
  "transition-all duration-150 whitespace-nowrap " +
  "disabled:opacity-45 disabled:cursor-not-allowed";

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
        <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />
      ) : (
        Glifo && <Glifo size={15} strokeWidth={1.75} aria-hidden="true" />
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
      {Glifo && <Glifo size={15} strokeWidth={1.75} aria-hidden="true" />}
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
      className={`text-xs text-tinta-3 underline underline-offset-2 decoration-filete-forte
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
