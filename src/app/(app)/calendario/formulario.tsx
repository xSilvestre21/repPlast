"use client";

/**
 * O formulário do compromisso — para marcar um novo ou alterar o existente.
 *
 * A importância é escolhida em três pílulas grandes, com a cor e o ícone de
 * cada uma, e a frase embaixo diz o que ela faz: "abre um aviso no Painel no
 * dia". É a escolha que muda o comportamento do sistema; não pode ficar
 * escondida num `<select>`.
 */

import { AlertTriangle, CalendarClock, Flag } from "lucide-react";
import { useActionState, useState } from "react";

import { CampoData } from "@/components/campo-data";
import { SelecaoBuscavel, type OpcaoBuscavel } from "@/components/selecao-buscavel";
import { Botao, BotaoTexto, CLASSE_CONTROLE, Campo, MensagemErro } from "@/components/ui";
import type { Importancia } from "@/lib/agenda";
import type { DataIso } from "@/lib/calendario";

import { salvarCompromisso, type EstadoFormulario } from "./acoes";
import type { CompromissoDaAgenda } from "./consulta";

const IMPORTANCIAS: {
  valor: Importancia;
  rotulo: string;
  cor: string;
  icone: typeof Flag;
  efeito: string;
}[] = [
  {
    valor: "NORMAL",
    rotulo: "Normal",
    cor: "var(--tinta-3)",
    icone: CalendarClock,
    efeito: "Aparece só no calendário.",
  },
  {
    valor: "IMPORTANTE",
    rotulo: "Importante",
    cor: "var(--grafico-4)",
    icone: Flag,
    efeito: "Fica em destaque no calendário e na faixa Hoje do Painel, no dia.",
  },
  {
    valor: "URGENTE",
    rotulo: "Urgente",
    cor: "var(--perigo)",
    icone: AlertTriangle,
    efeito: "Abre um aviso no Painel na véspera e no dia, até ser marcado como feito.",
  },
];

export function FormularioCompromisso({
  compromisso,
  dia,
  clientes,
  clientePadrao = "",
  aoTerminar,
}: {
  /** Presente: alterando. Ausente: marcando um novo. */
  compromisso?: CompromissoDaAgenda;
  dia: DataIso;
  clientes: OpcaoBuscavel[];
  clientePadrao?: string;
  aoTerminar: () => void;
}) {
  /*
   * Salvou sem erro: fecha — e o fechar acontece AQUI, na ação, depois que o
   * servidor respondeu. O ajuste de estado durante a renderização que o acerto
   * e a meta usam não serve: `aoTerminar` muda o estado do PAI (`PainelDia`),
   * e mudar outro componente no meio da renderização é o que o React recusa.
   */
  const [estado, enviar, salvando] = useActionState<EstadoFormulario, FormData>(
    async (anterior, formData) => {
      const resultado = await salvarCompromisso(compromisso?.id ?? null, anterior, formData);
      if (!resultado.erro) aoTerminar();
      return resultado;
    },
    {},
  );
  const [importancia, setImportancia] = useState<Importancia>(
    compromisso?.importancia ?? "NORMAL",
  );

  const escolhida = IMPORTANCIAS.find((i) => i.valor === importancia)!;

  return (
    <form action={enviar} className="space-y-4">
      <Campo
        name="titulo"
        rotulo="Título"
        required
        maxLength={200}
        defaultValue={compromisso?.titulo ?? ""}
        placeholder="Visita à AKILAH, reunião com a QUALYPLAST…"
        // Os dois, de propósito. `data-autofocus`: quando o formulário abre
        // junto com a janela, o `showModal()` rouba o foco e o `Dialogo` o
        // devolve aqui. `autoFocus`: quando ele monta com a janela já aberta
        // ("Marcar compromisso" no painel do dia), o React foca sozinho.
        data-autofocus=""
        autoFocus
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
        <CampoData
          name="data"
          rotulo="Data"
          defaultValue={compromisso?.dia ?? dia}
          atalhos={[1, 7, 14, 30]}
        />
        <label className="block">
          <span className="rotulo block mb-1.5 text-tinta-2">Hora</span>
          <input
            type="time"
            name="hora"
            defaultValue={compromisso?.hora ?? ""}
            className={`${CLASSE_CONTROLE} numerico`}
          />
          <span className="block text-mini text-tinta-3 mt-1">Vazio: o dia inteiro</span>
        </label>
      </div>

      <fieldset>
        <legend className="rotulo mb-1.5 text-tinta-2">Importância</legend>
        <div className="grid grid-cols-3 gap-2">
          {IMPORTANCIAS.map(({ valor, rotulo, cor, icone: Icone }) => {
            const ativa = valor === importancia;
            return (
              <label
                key={valor}
                className={`flex items-center justify-center gap-1.5 rounded-suave border px-3 py-2
                  text-corpo font-medium cursor-pointer transition-colors
                  has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-carimbo ${
                    ativa ? "text-tinta" : "border-filete text-tinta-2 hover:text-tinta"
                  }`}
                style={
                  ativa
                    ? { borderColor: cor, background: `color-mix(in oklab, ${cor} 14%, transparent)` }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="importancia"
                  value={valor}
                  checked={ativa}
                  onChange={() => setImportancia(valor)}
                  className="sr-only"
                />
                <Icone size={14} strokeWidth={2.25} style={{ color: cor }} aria-hidden="true" />
                {rotulo}
              </label>
            );
          })}
        </div>
        <p className="text-mini text-tinta-3 mt-1.5">{escolhida.efeito}</p>
      </fieldset>

      <SelecaoBuscavel
        name="clienteId"
        rotulo="Cliente (opcional)"
        opcoes={clientes}
        defaultValue={compromisso?.clienteId ?? clientePadrao}
        placeholder="Nenhum"
        dica="Vinculado, o compromisso aparece também na ficha do cliente."
      />

      <label className="block">
        <span className="rotulo block mb-1.5 text-tinta-2">Anotação</span>
        <textarea
          name="anotacao"
          rows={3}
          maxLength={2000}
          defaultValue={compromisso?.anotacao ?? ""}
          className={`${CLASSE_CONTROLE} resize-y`}
        />
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="compartilhado"
          defaultChecked={compromisso?.compartilhado ?? false}
          className="mt-1 size-4 accent-[var(--carimbo)]"
        />
        <span>
          <span className="text-corpo font-medium">Visível para o escritório</span>
          <span className="block text-mini text-tinta-3">
            Sem marcar, só você vê. Marcado, todos do escritório veem — mas só você altera.
          </span>
        </span>
      </label>

      <MensagemErro>{estado.erro}</MensagemErro>

      <div className="flex items-center gap-3">
        <Botao type="submit" carregando={salvando}>
          {compromisso ? "Salvar alterações" : "Marcar compromisso"}
        </Botao>
        <BotaoTexto type="button" onClick={aoTerminar}>
          cancelar
        </BotaoTexto>
      </div>
    </form>
  );
}
