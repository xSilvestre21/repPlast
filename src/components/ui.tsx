import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/* Estrutura de página                                                        */
/* -------------------------------------------------------------------------- */

export function Cabecalho({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6 surgir">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight texto-gradiente">{titulo}</h1>
        {descricao && <p className="text-sm text-texto-suave mt-1.5 max-w-2xl">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-borda vidro shadow-[var(--sombra-cartao)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SecaoCartao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold tracking-tight">{titulo}</h2>
        {descricao && <p className="text-sm text-texto-suave mt-1">{descricao}</p>}
      </div>
      {children}
    </Cartao>
  );
}

/**
 * Linha de lista clicável.
 *
 * O fio de luz que corre na borda superior no hover é o detalhe que amarra as
 * listas à identidade — o mesmo gradiente da marca, em movimento.
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
      className={`group relative flex flex-wrap items-center gap-x-6 gap-y-2 p-4 transition-colors
        hover:bg-superficie-alta first:rounded-t-2xl last:rounded-b-2xl ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity
          bg-[linear-gradient(90deg,transparent,var(--acento-2),transparent)]"
      />
      {children}
    </Link>
  );
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return <Cartao className="p-12 text-center text-sm text-texto-suave">{children}</Cartao>;
}

/* -------------------------------------------------------------------------- */
/* Formulário                                                                 */
/* -------------------------------------------------------------------------- */

const CLASSE_CONTROLE =
  "w-full rounded-xl border border-borda bg-fundo-elevado px-3.5 py-2.5 text-sm text-texto " +
  "placeholder:text-texto-fraco outline-none transition-all duration-200 " +
  "focus:border-transparent focus:ring-2 focus:ring-[var(--acento-1)] " +
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
      <span className="block text-sm text-texto-suave mb-1.5">{rotulo}</span>
      <div className="relative">
        <input
          {...props}
          aria-invalid={erro ? true : undefined}
          className={`${CLASSE_CONTROLE} ${sufixo ? "pr-12" : ""} ${
            erro ? "border-perigo ring-1 ring-[var(--perigo)]" : ""
          } ${props.type === "number" ? "numerico" : ""}`}
        />
        {sufixo && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-texto-fraco pointer-events-none">
            {sufixo}
          </span>
        )}
      </div>
      {erro ? (
        <span className="block text-xs text-perigo mt-1.5">{erro}</span>
      ) : (
        dica && <span className="block text-xs text-texto-fraco mt-1.5">{dica}</span>
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
      <span className="block text-sm text-texto-suave mb-1.5">{rotulo}</span>
      <select {...props} className={CLASSE_CONTROLE}>
        {children}
      </select>
      {dica && <span className="block text-xs text-texto-fraco mt-1.5">{dica}</span>}
    </label>
  );
}

export function AreaTexto({
  className = "",
  ...props
}: ComponentProps<"textarea"> & { className?: string }) {
  return <textarea {...props} className={`${CLASSE_CONTROLE} resize-y ${className}`} />;
}

export function MensagemErro({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="surgir rounded-xl border border-perigo/40 bg-perigo-fraco px-4 py-3 text-sm text-perigo"
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
  primaria:
    "fundo-gradiente text-sobre-acento font-semibold shadow-[var(--brilho-acento)] " +
    "hover:brightness-110 hover:-translate-y-px active:translate-y-0",
  secundaria:
    "border border-borda-forte text-texto vidro hover:bg-superficie-alta hover:-translate-y-px active:translate-y-0",
  perigo: "border border-perigo/40 text-perigo hover:bg-perigo-fraco",
};

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm " +
  "transition-all duration-200 whitespace-nowrap " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:brightness-100";

export function Botao({
  variante = "primaria",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button {...props} className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`} />;
}

export function BotaoLink({
  variante = "primaria",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...props} className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`} />;
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
      className={`text-xs text-texto-fraco transition-colors px-1 disabled:opacity-50 ${
        perigoso ? "hover:text-perigo" : "hover:text-acento"
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
