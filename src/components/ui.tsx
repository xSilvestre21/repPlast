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
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="text-sm text-texto-suave mt-1">{descricao}</p>}
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
    <div className={`rounded-lg border border-borda bg-superficie ${className}`}>{children}</div>
  );
}

export function SecaoCartao({ titulo, descricao, children }: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <Cartao className="p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-medium">{titulo}</h2>
        {descricao && <p className="text-sm text-texto-suave mt-0.5">{descricao}</p>}
      </div>
      {children}
    </Cartao>
  );
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <Cartao className="p-10 text-center text-sm text-texto-suave">{children}</Cartao>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulário                                                                 */
/* -------------------------------------------------------------------------- */

const CLASSE_CONTROLE =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-texto " +
  "placeholder:text-texto-fraco outline-none transition-colors " +
  "focus:border-acento/60 focus:ring-1 focus:ring-acento/30 " +
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
            erro ? "border-perigo/70" : ""
          } ${props.type === "number" ? "numerico" : ""}`}
        />
        {sufixo && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-texto-fraco pointer-events-none">
            {sufixo}
          </span>
        )}
      </div>
      {erro ? (
        <span className="block text-xs text-perigo mt-1">{erro}</span>
      ) : (
        dica && <span className="block text-xs text-texto-fraco mt-1">{dica}</span>
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
      {dica && <span className="block text-xs text-texto-fraco mt-1">{dica}</span>}
    </label>
  );
}

export function MensagemErro({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-perigo/40 bg-perigo-escuro/60 px-3 py-2 text-sm text-perigo"
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
  primaria: "bg-acento text-fundo hover:bg-acento/90 font-medium",
  secundaria: "border border-borda-forte text-texto hover:bg-superficie-alta",
  perigo: "border border-perigo/40 text-perigo hover:bg-perigo-escuro",
};

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

export function Botao({
  variante = "primaria",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button {...props} className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`} />
  );
}

export function BotaoLink({
  variante = "primaria",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...props} className={`${CLASSE_BOTAO} ${VARIANTES[variante]} ${className}`} />;
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
