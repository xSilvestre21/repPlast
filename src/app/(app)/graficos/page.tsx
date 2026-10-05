import { BarChart3 } from "lucide-react";

import { ManterEscolhas } from "@/components/manter-escolhas";
import { NavegadorMes } from "@/components/navegador-mes";
import { Pagina } from "@/components/pagina";
import { Cabecalho } from "@/components/ui";
import { competenciaDe } from "@/lib/comissao";
import { escopoAtual } from "@/lib/sessao";

import { carregarBaseDosGraficos } from "./dados";
import { BotoesExportacao, LinkRelatorioHtml } from "./exportacao";
import { PainelGraficos } from "./painel";

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

  return (
    <Pagina>
      <Cabecalho
        icone={BarChart3}
        titulo="Gráficos"
        descricao="A mesma apuração da tela de Comissões, vista de vários lados. Cada cartão escolhe o próprio período; passe o mouse para os números e clique para abrir o que está por trás."
        // Os links leem o período dos cartões na hora — ver `exportacao.tsx`.
        acao={<BotoesExportacao competencia={competencia} />}
      />

      {/* As escolhas feitas nos cartões depois do carregamento vão junto. */}
      <ManterEscolhas>
        <NavegadorMes competencia={competencia} href={endereco} className="mb-7" />
      </ManterEscolhas>

      <PainelGraficos base={base} />

      <p className="text-mini text-tinta-3 text-center pt-7">
        <LinkRelatorioHtml competencia={competencia} />
      </p>
    </Pagina>
  );
}
