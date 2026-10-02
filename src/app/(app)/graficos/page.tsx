import { BarChart3, FileDown, Sheet } from "lucide-react";

import { ManterEscolhas } from "@/components/manter-escolhas";
import { NavegadorMes } from "@/components/navegador-mes";
import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho } from "@/components/ui";
import { competenciaDe } from "@/lib/comissao";
import { escopoAtual } from "@/lib/sessao";

import { carregarBaseDosGraficos } from "./dados";
import { PainelGraficos } from "./painel";

/**
 * O que o relatório PDF/HTML aceita (`exportar/parametros.ts`). A tela tem
 * períodos por cartão; o relatório ainda tem uma janela só, então ele recebe
 * a do mês a mês e o corte do cartão de sumidos, quando foram escolhidos.
 */
const JANELAS_DO_RELATORIO = [3, 6, 12];
const CORTES_DO_RELATORIO = [30, 60, 90, 180];

export default async function PaginaGraficos({ searchParams }: PageProps<"/graficos">) {
  const parametros = await searchParams;

  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  const { organizacaoId, db, ehAdmin, usuarioId, plano } = await escopoAtual();

  /*
   * Um único instante para toda a página — a mesma exceção documentada no
   * painel inicial. A regra de pureza existe por causa de componente de
   * cliente, que re-renderiza; este é de SERVIDOR e a rota é dinâmica, roda uma
   * vez por requisição, e "quantos dias sem comprar" depende de agora.
   */
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const base = await carregarBaseDosGraficos(db, organizacaoId, {
    ehAdmin,
    usuarioId,
    plano,
    competencia,
    agora,
  });

  /**
   * Mantém os outros parâmetros ao trocar de mês — as escolhas dos cartões
   * (`cli_visao`, `mes_periodo`…), que eles gravam na URL. Trocar de mês não
   * pode desfazer a visão que a pessoa montou.
   */
  const endereco = (mes: string) => {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros)) {
      if (typeof valor === "string" && chave !== "mes") busca.set(chave, valor);
    }
    if (mes !== competenciaDe(new Date())) busca.set("mes", mes);
    const consulta = busca.toString();
    return consulta ? `/graficos?${consulta}` : "/graficos";
  };

  const janela = JANELAS_DO_RELATORIO.includes(Number(parametros.mes_periodo))
    ? Number(parametros.mes_periodo)
    : 6;
  const dias = CORTES_DO_RELATORIO.includes(Number(parametros.sum_dias))
    ? Number(parametros.sum_dias)
    : 60;

  /*
   * O CSV leva os PEDIDOS, não o gráfico: todo cartão desta aba é uma soma
   * dessas linhas, então quem as tem no Excel refaz qualquer um deles — e
   * também os cruzamentos que a tela não mostra.
   */
  const enderecoCsv = (escopo: "mes" | "janela") =>
    `/graficos/exportar/csv?mes=${competencia}&escopo=${escopo}&meses=${janela}`;

  const enderecoRelatorio = (formato: "pdf" | "html") =>
    `/graficos/exportar/${formato}?mes=${competencia}&meses=${janela}&dias=${dias}`;

  return (
    <Pagina>
      <Cabecalho
        icone={BarChart3}
        titulo="Gráficos"
        descricao="A mesma apuração da tela de Comissões, vista de vários lados. Cada cartão escolhe o próprio período; passe o mouse para os números e clique para abrir o que está por trás."
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
            <BotaoLink
              href={enderecoCsv("janela")}
              target="_blank"
              variante="secundaria"
              icone={Sheet}
            >
              CSV de {janela} meses
            </BotaoLink>
          </div>
        }
      />

      {/* As escolhas feitas nos cartões depois do carregamento vão junto. */}
      <ManterEscolhas>
        <NavegadorMes competencia={competencia} href={endereco} className="mb-7" />
      </ManterEscolhas>

      <PainelGraficos base={base} />

      <p className="text-mini text-tinta-3 text-center pt-7">
        <a href={enderecoRelatorio("html")} target="_blank" className="hover:text-carimbo">
          Baixar o relatório como um arquivo HTML que abre sozinho
        </a>
      </p>
    </Pagina>
  );
}
