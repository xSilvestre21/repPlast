"use client";

/**
 * A aba Calendário no navegador: a visão (mês ou lista), os filtros por tipo e
 * o dia aberto.
 *
 * A visão e os filtros vão para a URL (`useParametro`), como os cartões dos
 * gráficos: o link copiado abre do mesmo jeito, e trocar de mês pelas setas
 * não desfaz o filtro.
 */

import { CalendarDays, List } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Dialogo } from "@/components/dialogo";
import { SeletorVisao } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import type { OpcaoBuscavel } from "@/components/selecao-buscavel";
import { Cartao } from "@/components/ui";
import { ordenarDoDia, type EventoAgenda, type TipoEvento } from "@/lib/agenda";
import { dataCurta, type DataIso } from "@/lib/calendario";

import type { CompromissoDaAgenda } from "./consulta";
import { GradeDoMes } from "./grade";
import { ListaDaAgenda } from "./lista";
import { LEGENDA_DE_DESTAQUES, TIPOS_FILTRAVEIS } from "./marca";
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

  /*
   * O "Novo compromisso" do cabeçalho é um link para `?novo=1` — com a página
   * já aberta, o estado inicial acima não roda de novo. Então a chegada do
   * parâmetro abre o formulário, pelo ajuste de estado durante a renderização
   * (o mesmo do acerto e da meta), sem efeito com `setState`.
   */
  const novo = useSearchParams().get("novo") === "1";
  const [novoVisto, setNovoVisto] = useState(novo);
  if (novo !== novoVisto) {
    setNovoVisto(novo);
    if (novo) setAberto({ dia: hoje, marcando: true });
  }

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

  const filtros: Record<TipoEvento, [string, (v: "sim" | "nao") => void]> = {
    compromisso: [verCompromissos, setVerCompromissos],
    entrega: [verEntregas, setVerEntregas],
    parcela: [verParcelas, setVerParcelas],
    sumido: [verSumidos, setVerSumidos],
  };

  return (
    <>
      {/*
        A barra de controles num cartão, como a busca de Pedidos e Clientes —
        e não solta sobre o fundo. A ação principal ("Novo compromisso") mora
        no cabeçalho, como em toda tela; aqui ficam só a visão e o que mostrar.
      */}
      <Cartao className="p-4 sm:p-5 mb-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div>
          <span className="rotulo block mb-1.5 text-tinta-2">Visão</span>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "mes", rotulo: "Mês", icone: CalendarDays },
              { valor: "lista", rotulo: "Próximos 30 dias", icone: List },
            ]}
          />
        </div>

        <div className="min-w-0">
          <span className="rotulo block mb-1.5 text-tinta-2">Mostrar</span>
          {/*
            Chips discretos, cada um com o ícone e a cor do tipo — eles são a
            legenda desses tipos. Desligado, o chip apaga e o ícone perde a cor:
            continua lá para religar, mas não disputa atenção.
          */}
          <div role="group" aria-label="Tipos mostrados" className="flex flex-wrap gap-2">
            {TIPOS_FILTRAVEIS.map(({ tipo, rotulo, cor, icone: Icone }) => {
              const [valor, definir] = filtros[tipo];
              const ligado = valor === "sim";
              return (
                <button
                  key={tipo}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => definir(ligado ? "nao" : "sim")}
                  className={`chip cursor-pointer transition-[opacity,box-shadow] duration-200 ${
                    ligado ? "" : "opacity-55 shadow-none"
                  }`}
                >
                  <Icone
                    size={13}
                    strokeWidth={2.25}
                    aria-hidden="true"
                    style={{ color: ligado ? cor : "var(--tinta-3)" }}
                  />
                  <span className={ligado ? "" : "line-through decoration-tinta-3"}>{rotulo}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Cartao>
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

      {/*
        Embaixo só o que os filtros não explicam: os destaques de atenção. Cor
        nunca sozinha — cada um tem também o ícone.
      */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-mini text-tinta-2">
        {LEGENDA_DE_DESTAQUES.map(({ chave, rotulo, cor, icone: Icone }) => (
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
