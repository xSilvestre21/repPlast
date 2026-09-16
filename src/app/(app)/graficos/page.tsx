import Link from "next/link";
import {
  BarChart3,
  Factory,
  FileCheck2,
  FileDown,
  Sheet,
  TrendingUp,
  Truck,
  UserMinus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import { BaixarGrafico } from "@/components/baixar-grafico";
import { GraficoAbc } from "@/components/grafico-abc";
import { GraficoBarras } from "@/components/grafico-barras";
import { GraficoMoldura } from "@/components/grafico-moldura";
import { GraficoRosca } from "@/components/grafico-rosca";
import { GraficoSerie } from "@/components/grafico-serie";
import { NavegadorMes } from "@/components/navegador-mes";
import { Pagina } from "@/components/pagina";
import {
  BotaoLink,
  Cabecalho,
  GradeTotais,
  Segmentado,
  Total,
  formatarMoeda,
} from "@/components/ui";
import { competenciaDe } from "@/lib/comissao";
import { SERIES_DA_COMISSAO } from "@/lib/grafico/paleta";
import { escopoAtual } from "@/lib/sessao";

import { carregarDadosDosGraficos } from "./dados";

/** Quantas barras antes de juntar o resto numa linha só. */
const TETO = 12;

/** Tamanhos de janela do histórico, em meses. */
const JANELAS = [3, 6, 12];
const JANELA_PADRAO = 6;

/** Cortes de positivação, iguais aos do painel inicial. */
const CORTES = [30, 60, 90, 180];
const CORTE_PADRAO = 60;

export default async function PaginaGraficos({ searchParams }: PageProps<"/graficos">) {
  const parametros = await searchParams;

  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  // Tudo mora na URL para poder ser aberto em aba nova e mandado por mensagem
  // — o mesmo motivo do corte de positivação no painel.
  const todos = parametros.todos === "1";
  const meses = JANELAS.includes(Number(parametros.meses))
    ? Number(parametros.meses)
    : JANELA_PADRAO;
  const dias = CORTES.includes(Number(parametros.dias)) ? Number(parametros.dias) : CORTE_PADRAO;

  const { organizacaoId, db, ehAdmin, usuarioId, plano } = await escopoAtual();

  /*
   * Um único instante para toda a página — a mesma exceção documentada no
   * painel inicial. A regra de pureza existe por causa de componente de
   * cliente, que re-renderiza; este é de SERVIDOR e a rota é dinâmica, roda uma
   * vez por requisição, e "quantos dias sem comprar" depende de agora.
   */
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const dados = await carregarDadosDosGraficos(db, organizacaoId, {
    ehAdmin,
    usuarioId,
    plano,
    competencia,
    meses,
    dias,
    agora,
  });

  const { mes, janela, vista } = dados;

  /** Mantém os outros parâmetros ao mexer num só. */
  const endereco = (mudanca: { mes?: string; todos?: boolean; meses?: number; dias?: number }) => {
    const busca = new URLSearchParams();
    const alvo = {
      mes: mudanca.mes ?? competencia,
      todos: mudanca.todos ?? todos,
      meses: mudanca.meses ?? meses,
      dias: mudanca.dias ?? dias,
    };

    if (alvo.mes !== competenciaDe(new Date())) busca.set("mes", alvo.mes);
    if (alvo.todos) busca.set("todos", "1");
    if (alvo.meses !== JANELA_PADRAO) busca.set("meses", String(alvo.meses));
    if (alvo.dias !== CORTE_PADRAO) busca.set("dias", String(alvo.dias));

    const consulta = busca.toString();
    return consulta ? `/graficos?${consulta}` : "/graficos";
  };

  /*
   * O CSV leva os PEDIDOS, não o gráfico: todo cartão desta aba é uma soma
   * dessas linhas, então quem as tem no Excel refaz qualquer um deles — e
   * também os cruzamentos que a tela não mostra.
   */
  const enderecoCsv = (escopo: "mes" | "janela") =>
    `/graficos/exportar/csv?mes=${competencia}&escopo=${escopo}&meses=${meses}`;

  const enderecoRelatorio = (formato: "pdf" | "html") =>
    `/graficos/exportar/${formato}?mes=${competencia}&meses=${meses}&dias=${dias}`;

  return (
    <Pagina>
      <Cabecalho
        icone={BarChart3}
        titulo="Gráficos"
        descricao="A mesma apuração da tela de Comissões, vista de lado. Nenhuma barra é cortada: a lista cresce e rola."
        acao={
          <div className="flex flex-wrap gap-2 items-start">
            <BotaoLink
              href={enderecoRelatorio("pdf")}
              target="_blank"
              variante="secundaria"
              icone={FileDown}
            >
              Relatório PDF
            </BotaoLink>
            <BotaoLink
              href={enderecoCsv("mes")}
              target="_blank"
              variante="secundaria"
              icone={Sheet}
            >
              CSV do mês
            </BotaoLink>
          </div>
        }
      />

      <NavegadorMes
        competencia={competencia}
        href={(alvo) => endereco({ mes: alvo })}
        className="mb-7"
      />

      <div className="space-y-5">
        <GradeTotais>
          <Total rotulo="Previsto" valor={formatarMoeda(vista.previsto.toString())} />
          <Total rotulo="Recebido" valor={formatarMoeda(vista.recebido.toString())} tom="verde" />
          <Total
            rotulo="A acertar"
            valor={formatarMoeda(vista.aAcertar.toString())}
            detalhe={`${dados.pedidosDoMes} ${dados.pedidosDoMes === 1 ? "pedido" : "pedidos"} no mês`}
          />
          <Total
            rotulo="Diferença"
            valor={formatarMoeda(vista.diferenca.toString())}
            tom={
              vista.diferenca.isZero()
                ? undefined
                : vista.diferenca.isNegative()
                  ? "perigo"
                  : "verde"
            }
          />
        </GradeTotais>

        <div className="grid gap-5 lg:grid-cols-2">
          <GraficoMoldura
            titulo="Comissão por indústria"
            periodo={mes}
            icone={Factory}
            tom="pessego"
            baixar={
              <BaixarGrafico
                titulo="Comissão por indústria"
                periodo={mes}
                dados={{
                  tipo: "barras",
                  itens: dados.porIndustria,
                  teto: TETO,
                  rotuloResiduo: "Outras",
                }}
              />
            }
            vazio={dados.porIndustria.length === 0 ? "Nenhum pedido enviado neste mês." : undefined}
          >
            <GraficoBarras itens={dados.porIndustria} teto={TETO} rotuloResiduo="Outras" />
          </GraficoMoldura>

          <GraficoMoldura
            titulo="Comissão por cliente"
            periodo={mes}
            icone={Users}
            tom="lilas"
            acao={
              dados.porCliente.length > TETO + 1 ? (
                <Link
                  href={endereco({ todos: !todos })}
                  className="text-mini font-semibold text-carimbo hover:underline whitespace-nowrap"
                >
                  {todos ? "Ver o topo" : `Ver todos (${dados.porCliente.length})`}
                </Link>
              ) : undefined
            }
            baixar={
              <BaixarGrafico
                titulo="Comissão por cliente"
                periodo={mes}
                dados={{
                  tipo: "barras",
                  itens: dados.porCliente,
                  teto: todos ? Infinity : TETO,
                }}
              />
            }
            vazio={dados.porCliente.length === 0 ? "Nenhum pedido enviado neste mês." : undefined}
          >
            {/*
              Com a lista inteira aberta o contêiner ganha teto, mas continua
              sendo ELE que rola. A página nunca rola de lado por causa de um
              gráfico — é o mesmo contrato da tabela.
            */}
            <GraficoBarras
              itens={dados.porCliente}
              teto={todos ? Infinity : TETO}
              alturaMaxima={todos ? "max-h-[32rem]" : undefined}
            />
          </GraficoMoldura>

          {dados.porPreposto && (
            <GraficoMoldura
              titulo="Comissão por preposto"
              periodo={mes}
              icone={UserRound}
              tom="mar"
              baixar={
                <BaixarGrafico
                  titulo="Comissão por preposto"
                  periodo={mes}
                  dados={{ tipo: "barras", itens: dados.porPreposto, teto: TETO }}
                />
              }
              vazio={
                dados.porPreposto.length === 0
                  ? "Nenhum pedido deste mês está creditado a um preposto."
                  : undefined
              }
            >
              <GraficoBarras itens={dados.porPreposto} teto={TETO} />
            </GraficoMoldura>
          )}

          <GraficoMoldura
            titulo="Pedidos cancelados"
            periodo={mes}
            icone={XCircle}
            baixar={
              <BaixarGrafico
                titulo="Pedidos cancelados"
                periodo={mes}
                dados={{ tipo: "barras", itens: dados.perdidos, teto: TETO }}
              />
            }
            vazio={dados.perdidos.length === 0 ? "Nenhum pedido cancelado neste mês." : undefined}
          >
            <GraficoBarras itens={dados.perdidos} teto={TETO} />
          </GraficoMoldura>
        </div>

        {/*
          A divisa separa duas perguntas diferentes — "como foi este mês" e
          "para onde isso está indo" —, e cada uma tem o seu controle. Um
          controle só para as duas faria a janela de doze meses mudar o mês da
          apuração junto, que não é o que ninguém quer.
        */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 regra">
          <h2 className="text-realce font-semibold text-tinta">Histórico</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Segmentado
              nome="Janela do histórico"
              atual={String(meses)}
              opcoes={JANELAS.map((opcao) => ({
                valor: String(opcao),
                rotulo: `${opcao} meses`,
                href: endereco({ meses: opcao }),
              }))}
            />
            <BotaoLink
              href={enderecoCsv("janela")}
              target="_blank"
              variante="secundaria"
              tamanho="compacto"
              icone={Sheet}
            >
              CSV
            </BotaoLink>
          </div>
        </div>

        <GraficoMoldura
          titulo="Comissão mês a mês"
          periodo={janela}
          icone={TrendingUp}
          tom="menta"
          baixar={
            <BaixarGrafico
              titulo="Comissão mês a mês"
              periodo={janela}
              dados={{ tipo: "serie", pontos: dados.serieMensal, series: SERIES_DA_COMISSAO }}
            />
          }
          vazio={
            dados.abcDeClientes.length === 0 ? "Nenhum pedido enviado nesta janela." : undefined
          }
        >
          <GraficoSerie pontos={dados.serieMensal} series={SERIES_DA_COMISSAO} />
        </GraficoMoldura>

        <div className="grid gap-5 lg:grid-cols-2">
          <GraficoMoldura
            titulo="Curva ABC de clientes"
            periodo={janela}
            icone={Users}
            tom="lilas"
            vazio={
              dados.abcDeClientes.length === 0 ? "Nenhum pedido enviado nesta janela." : undefined
            }
          >
            <GraficoAbc itens={dados.abcDeClientes} />
          </GraficoMoldura>

          <GraficoMoldura
            titulo="Orçamento que virou pedido"
            periodo={janela}
            icone={FileCheck2}
            tom="sol"
            vazio={
              dados.totalOrcamentos === 0
                ? "Nenhuma proposta criada nesta janela."
                : dados.conversaoSemHistorico
                  ? `Nenhuma das ${dados.totalOrcamentos} propostas desta janela foi convertida aqui. Proposta importada do sistema antigo não guarda essa ligação — o número passa a valer para as criadas no RepPlast.`
                  : undefined
            }
          >
            <GraficoRosca
              itens={dados.conversao}
              centro={`${Math.round((dados.viraramPedido / Math.max(1, dados.totalOrcamentos)) * 100)}%`}
              detalheDoCentro="fecharam"
            />
          </GraficoMoldura>

          <GraficoMoldura
            titulo="Pontualidade de entrega"
            periodo={janela}
            icone={Truck}
            tom="menta"
            vazio={
              dados.totalEntregas === 0
                ? "Nenhum pedido desta janela tem entrega registrada."
                : undefined
            }
          >
            <GraficoRosca
              itens={dados.entregas}
              centro={`${Math.round((dados.semAtraso / Math.max(1, dados.totalEntregas)) * 100)}%`}
              detalheDoCentro="sem atraso"
            />
          </GraficoMoldura>

          <GraficoMoldura
            titulo="Clientes sumidos"
            periodo={`Sem comprar há mais de ${dias} dias`}
            icone={UserMinus}
            tom="pessego"
            acao={
              <Segmentado
                nome="Dias sem comprar"
                atual={String(dias)}
                opcoes={CORTES.map((opcao) => ({
                  valor: String(opcao),
                  rotulo: `${opcao}d`,
                  href: endereco({ dias: opcao }),
                }))}
              />
            }
            baixar={
              <BaixarGrafico
                titulo="Clientes sumidos"
                periodo={`Sem comprar há mais de ${dias} dias`}
                unidade="dias"
                dados={{
                  tipo: "barras",
                  itens: dados.sumidos,
                  teto: TETO,
                  mostrarTotal: false,
                }}
              />
            }
            vazio={
              dados.sumidos.length === 0
                ? `Ninguém passou de ${dias} dias sem comprar.`
                : undefined
            }
          >
            {/*
              Somar dias não é um número: "3.456 dias" não significa nada. O
              ranking é o que vale, do mais abandonado para o menos.
            */}
            <GraficoBarras
              itens={dados.sumidos}
              teto={TETO}
              unidade="dias"
              mostrarTotal={false}
            />
          </GraficoMoldura>
        </div>

        <p className="text-mini text-tinta-3 text-center pt-2">
          <a href={enderecoRelatorio("html")} target="_blank" className="hover:text-carimbo">
            Baixar esta página como um arquivo HTML que abre sozinho
          </a>
        </p>
      </div>
    </Pagina>
  );
}
