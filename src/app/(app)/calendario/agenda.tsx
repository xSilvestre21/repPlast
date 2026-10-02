"use client";

/**
 * A aba Calendário no navegador: a visão (mês ou lista), os filtros por tipo e
 * o dia aberto.
 *
 * A visão e os filtros vão para a URL (`useParametro`), como os cartões dos
 * gráficos: o link copiado abre do mesmo jeito, e trocar de mês pelas setas
 * não desfaz o filtro.
 */

import { CalendarDays, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialogo } from "@/components/dialogo";
import { Alternancia, SeletorVisao } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import type { OpcaoBuscavel } from "@/components/selecao-buscavel";
import { Botao } from "@/components/ui";
import { ordenarDoDia, type EventoAgenda } from "@/lib/agenda";
import { dataCurta, type DataIso } from "@/lib/calendario";

import type { CompromissoDaAgenda } from "./consulta";
import { GradeDoMes } from "./grade";
import { ListaDaAgenda } from "./lista";
import { LEGENDA } from "./marca";
import { PainelDia, type ItemDoDia } from "./painel-dia";

const VISOES = ["mes", "lista"] as const;
const SIM_NAO = ["sim", "nao"] as const;

export function Agenda({
  competencia,
  hoje,
  semanas,
  compromissos,
  automaticos,
  clientes,
  abrirNovo,
  clientePadrao,
}: {
  competencia: string;
  hoje: DataIso;
  semanas: DataIso[][];
  compromissos: CompromissoDaAgenda[];
  automaticos: EventoAgenda[];
  clientes: OpcaoBuscavel[];
  /** Veio da ficha do cliente com "marcar compromisso": abre o formulário já. */
  abrirNovo: boolean;
  clientePadrao: string;
}) {
  const [visao, setVisao] = useParametro("visao", "mes", VISOES);
  const [verCompromissos, setVerCompromissos] = useParametro("ver_compromissos", "sim", SIM_NAO);
  const [verEntregas, setVerEntregas] = useParametro("ver_entregas", "sim", SIM_NAO);
  const [verParcelas, setVerParcelas] = useParametro("ver_parcelas", "sim", SIM_NAO);
  const [verSumidos, setVerSumidos] = useParametro("ver_sumidos", "sim", SIM_NAO);

  const [aberto, setAberto] = useState<{ dia: DataIso; marcando: boolean } | null>(
    abrirNovo ? { dia: hoje, marcando: true } : null,
  );

  const porDia = useMemo(() => {
    const ligado = {
      compromisso: verCompromissos === "sim",
      entrega: verEntregas === "sim",
      parcela: verParcelas === "sim",
      sumido: verSumidos === "sim",
    };
    const visiveis: ItemDoDia[] = [...compromissos, ...automaticos].filter((e) => ligado[e.tipo]);

    const grupos = Map.groupBy(visiveis, (e) => e.dia);
    return new Map(
      [...grupos].map(([dia, lista]) => [dia, ordenarDoDia(lista) as ItemDoDia[]]),
    );
  }, [compromissos, automaticos, verCompromissos, verEntregas, verParcelas, verSumidos]);

  const filtros: [string, string, (v: "sim" | "nao") => void][] = [
    ["Compromissos", verCompromissos, setVerCompromissos],
    ["Entregas", verEntregas, setVerEntregas],
    ["Parcelas", verParcelas, setVerParcelas],
    ["Clientes sumidos", verSumidos, setVerSumidos],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SeletorVisao
          atual={visao}
          aoEscolher={setVisao}
          opcoes={[
            { valor: "mes", rotulo: "Mês", icone: CalendarDays },
            { valor: "lista", rotulo: "Próximos 30 dias", icone: List },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {filtros.map(([rotulo, valor, definir]) => (
            <Alternancia key={rotulo} ligada={valor === "sim"} aoMudar={(l) => definir(l ? "sim" : "nao")}>
              {rotulo}
            </Alternancia>
          ))}
        </div>
        <Botao
          type="button"
          tamanho="compacto"
          icone={Plus}
          className="ml-auto"
          onClick={() => setAberto({ dia: hoje, marcando: true })}
        >
          Novo compromisso
        </Botao>
      </div>

      {visao === "mes" ? (
        <GradeDoMes
          semanas={semanas}
          competencia={competencia}
          hoje={hoje}
          porDia={porDia}
          aoAbrir={(dia) => setAberto({ dia, marcando: false })}
        />
      ) : (
        <ListaDaAgenda hoje={hoje} porDia={porDia} aoAbrir={(dia) => setAberto({ dia, marcando: false })} />
      )}

      {/* A legenda: cor nunca sozinha — cada tipo tem também o ícone. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-mini text-tinta-2">
        {LEGENDA.map(({ chave, rotulo, cor, icone: Icone }) => (
          <li key={chave} className="inline-flex items-center gap-1.5">
            <Icone size={12} strokeWidth={2.25} style={{ color: cor }} aria-hidden="true" />
            {rotulo}
          </li>
        ))}
      </ul>

      <Dialogo
        aberto={aberto !== null}
        aoFechar={() => {
          setAberto(null);
          // O `?novo=1&cliente=…` da ficha do cliente já cumpriu o papel: sem
          // tirá-lo, recarregar a página reabriria o formulário.
          const busca = new URLSearchParams(window.location.search);
          if (busca.has("novo") || busca.has("cliente")) {
            busca.delete("novo");
            busca.delete("cliente");
            const consulta = busca.toString();
            window.history.replaceState(null, "", consulta ? `/calendario?${consulta}` : "/calendario");
          }
        }}
        titulo={aberto ? dataCurta(aberto.dia, hoje) : ""}
      >
        {aberto && (
          <PainelDia
            // A chave remonta o painel ao trocar de dia: a lista volta, o
            // formulário pela metade do outro dia não vem junto.
            key={`${aberto.dia}:${aberto.marcando}`}
            dia={aberto.dia}
            itens={porDia.get(aberto.dia) ?? []}
            clientes={clientes}
            comecarMarcando={aberto.marcando}
            clientePadrao={aberto.marcando ? clientePadrao : ""}
          />
        )}
      </Dialogo>
    </>
  );
}
