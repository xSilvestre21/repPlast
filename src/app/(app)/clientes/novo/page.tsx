import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { criarCliente, criarClienteDaProposta } from "../acoes";
import { FormularioCliente } from "../formulario";
import { VALORES_VAZIOS } from "../valores";
import { UserRoundPlus } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaNovoCliente({ searchParams }: PageProps<"/clientes/novo">) {
  const { orcamento: orcamentoId } = await searchParams;

  /*
   * Vindo de uma proposta avulsa: o cadastro é o mesmo, mas nasce com o nome e
   * a cidade que a proposta já sabia, e ao salvar volta para ela vinculado.
   * Proposta que já tem cliente (ou não existe) cai no cadastro comum.
   */
  const { organizacaoId, db } = await escopoAtual();
  const proposta =
    typeof orcamentoId === "string"
      ? await db.orcamento.findFirst({
          where: { id: orcamentoId, organizacaoId, clienteId: null },
          select: {
            id: true,
            numero: true,
            clienteAvulsoNome: true,
            clienteAvulsoMunicipio: true,
          },
        })
      : null;

  if (proposta) {
    const nome = proposta.clienteAvulsoNome ?? "";

    return (
      <Pagina>
        <Cabecalho
          voltar={{ href: `/orcamentos/${proposta.id}`, rotulo: `Orçamento #${proposta.numero}` }}
          icone={UserRoundPlus}
          titulo="Novo cliente"
          descricao="Ao salvar, a proposta passa a ser deste cliente. Depois é cadastrar os itens dela como produtos dele — aí sim ela pode virar pedido."
        />
        <FormularioCliente
          acao={criarClienteDaProposta.bind(null, proposta.id)}
          valores={{
            ...VALORES_VAZIOS,
            apelido: nome,
            razaoSocial: nome,
            municipio: proposta.clienteAvulsoMunicipio ?? "",
          }}
          rotuloEnvio="Cadastrar e voltar à proposta"
        />
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        icone={UserRoundPlus}
        titulo="Novo cliente"
        descricao="Depois de salvar você poderá registrar os códigos que este cliente usa para cada produto."
      />
      <FormularioCliente
        acao={criarCliente}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar cliente"
      />
    </Pagina>
  );
}
