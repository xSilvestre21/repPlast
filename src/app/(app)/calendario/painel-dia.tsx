"use client";

/**
 * O dia aberto: tudo o que há nele e o formulário para marcar mais.
 *
 * O compromisso tem as ações dele (feito, alterar, excluir) — só para quem o
 * marcou; o do colega, compartilhado, aparece com o nome de quem marcou e sem
 * botões. O evento automático (entrega, parcela, cliente sumido) é um link
 * para onde ele mora: o calendário mostra, mas quem altera é o pedido.
 */

import { Check, ChevronRight, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import type { OpcaoBuscavel } from "@/components/selecao-buscavel";
import { MensagemErro } from "@/components/ui";
import type { EventoAgenda } from "@/lib/agenda";
import { dataPorExtenso, nomeDoFeriado, type DataIso } from "@/lib/calendario";

import { concluirCompromisso, excluirCompromisso, type EstadoFormulario } from "./acoes";
import type { CompromissoDaAgenda } from "./consulta";
import { FormularioCompromisso } from "./formulario";
import { aparencia } from "./marca";

export type ItemDoDia = EventoAgenda | CompromissoDaAgenda;

const ehCompromisso = (e: ItemDoDia): e is CompromissoDaAgenda => e.tipo === "compromisso";

export function PainelDia({
  dia,
  itens,
  clientes,
  comecarMarcando = false,
  clientePadrao = "",
}: {
  dia: DataIso;
  itens: ItemDoDia[];
  clientes: OpcaoBuscavel[];
  comecarMarcando?: boolean;
  clientePadrao?: string;
}) {
  /** `null`: a lista. "novo": marcando. Um compromisso: alterando ele. */
  const [editando, setEditando] = useState<"novo" | CompromissoDaAgenda | null>(
    comecarMarcando ? "novo" : null,
  );
  const feriado = nomeDoFeriado(dia);

  if (editando !== null) {
    return (
      <FormularioCompromisso
        dia={dia}
        clientes={clientes}
        clientePadrao={clientePadrao}
        compromisso={editando === "novo" ? undefined : editando}
        aoTerminar={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-corpo text-tinta-2 first-letter:uppercase">
        {dataPorExtenso(dia)}
        {feriado && <span className="ml-2 text-mini font-semibold text-perigo">{feriado}</span>}
      </p>

      {itens.length === 0 ? (
        <p className="text-corpo text-tinta-3 py-4 text-center">Nada marcado neste dia.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item) =>
            ehCompromisso(item) ? (
              <LinhaCompromisso key={item.chave} compromisso={item} aoEditar={() => setEditando(item)} />
            ) : (
              <LinhaAutomatica key={item.chave} evento={item} />
            ),
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setEditando("novo")}
        className="w-full flex items-center justify-center gap-2 rounded-suave border border-dashed
          border-filete-forte py-2.5 text-corpo font-medium text-tinta-2 hover:text-tinta hover:bg-folha-2
          transition-colors cursor-pointer"
      >
        <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
        Marcar compromisso
      </button>
    </div>
  );
}

function Faixa({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <li
      className="rounded-suave border border-filete border-l-[4px] px-3 py-2.5"
      style={{ borderLeftColor: cor, background: `color-mix(in oklab, ${cor} 7%, transparent)` }}
    >
      {children}
    </li>
  );
}

function LinhaAutomatica({ evento }: { evento: EventoAgenda }) {
  const { cor, icone: Icone, rotulo } = aparencia(evento);
  const pago = evento.situacao === "paga";

  return (
    <Faixa cor={cor}>
      <Link href={evento.href ?? "#"} className="flex items-center gap-3 group">
        <Icone size={16} strokeWidth={2} style={{ color: cor }} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block text-corpo font-medium truncate ${pago ? "line-through text-tinta-3" : ""}`}>
            {evento.titulo}
          </span>
          <span className="block text-mini text-tinta-3 truncate">
            {rotulo}
            {evento.detalhe && ` · ${evento.detalhe}`}
            {pago && " · paga"}
          </span>
        </span>
        <ChevronRight
          size={15}
          className="shrink-0 text-tinta-3 group-hover:text-carimbo transition-colors"
          aria-hidden="true"
        />
      </Link>
    </Faixa>
  );
}

function LinhaCompromisso({
  compromisso,
  aoEditar,
}: {
  compromisso: CompromissoDaAgenda;
  aoEditar: () => void;
}) {
  const { cor, icone: Icone, rotulo } = aparencia(compromisso);
  const feito = compromisso.situacao === "concluido";

  const [estadoFeito, alternarFeito, salvandoFeito] = useActionState<EstadoFormulario, FormData>(
    concluirCompromisso.bind(null, compromisso.id, !feito),
    {},
  );
  const [estadoExcluir, excluir, excluindo] = useActionState<EstadoFormulario, FormData>(
    excluirCompromisso.bind(null, compromisso.id),
    {},
  );

  return (
    <Faixa cor={cor}>
      <div className="flex items-start gap-3">
        <Icone size={16} strokeWidth={2} style={{ color: cor }} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className={`text-corpo font-medium ${feito ? "line-through text-tinta-3" : ""}`}>
            {compromisso.hora && <span className="numerico text-tinta-2 mr-1.5">{compromisso.hora}</span>}
            {compromisso.titulo}
          </div>
          <div className="text-mini text-tinta-3 flex flex-wrap items-center gap-x-2">
            <span>{rotulo}</span>
            {compromisso.clienteId && compromisso.cliente && (
              <Link href={`/clientes/${compromisso.clienteId}`} className="hover:text-carimbo">
                {compromisso.cliente}
              </Link>
            )}
            {compromisso.compartilhado && (
              <span className="inline-flex items-center gap-1">
                <Users size={10} aria-hidden="true" />
                {compromisso.meu ? "visível para o escritório" : `marcado por ${compromisso.autor}`}
              </span>
            )}
            {feito && <span className="text-verde font-medium">feito</span>}
          </div>
          {compromisso.anotacao && (
            <p className="text-mini text-tinta-2 mt-1.5 whitespace-pre-line">{compromisso.anotacao}</p>
          )}
        </div>

        {compromisso.meu && (
          <div className="shrink-0 flex items-center gap-0.5">
            <form action={alternarFeito}>
              <BotaoAcao
                rotulo={feito ? "Desfazer" : "Marcar como feito"}
                desabilitado={salvandoFeito}
                destaque={!feito}
              >
                {feito ? <RotateCcw size={14} /> : <Check size={14} />}
              </BotaoAcao>
            </form>
            <BotaoAcao rotulo="Alterar" aoClicar={aoEditar}>
              <Pencil size={14} />
            </BotaoAcao>
            <form
              action={excluir}
              onSubmit={(e) => {
                if (!confirm(`Excluir "${compromisso.titulo}"?`)) e.preventDefault();
              }}
            >
              <BotaoAcao rotulo="Excluir" desabilitado={excluindo} perigoso>
                <Trash2 size={14} />
              </BotaoAcao>
            </form>
          </div>
        )}
      </div>
      <MensagemErro>{estadoFeito.erro ?? estadoExcluir.erro}</MensagemErro>
    </Faixa>
  );
}

function BotaoAcao({
  rotulo,
  aoClicar,
  desabilitado = false,
  destaque = false,
  perigoso = false,
  children,
}: {
  rotulo: string;
  aoClicar?: () => void;
  desabilitado?: boolean;
  destaque?: boolean;
  perigoso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={aoClicar ? "button" : "submit"}
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className={`grid place-items-center size-8 rounded-full transition-colors cursor-pointer disabled:opacity-40 ${
        destaque
          ? "text-verde hover:bg-verde-fraco"
          : perigoso
            ? "text-tinta-3 hover:text-perigo hover:bg-perigo-fraco"
            : "text-tinta-3 hover:text-tinta hover:bg-folha-2"
      }`}
    >
      {children}
    </button>
  );
}

