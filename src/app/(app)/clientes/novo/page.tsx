import { redirect } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { criarCliente, criarClienteDaProposta } from "../acoes";
import { opcoesDeCarteira } from "../carteira";
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
  const escopo = await escopoAtual();
  const { organizacaoId, db } = escopo;
  // Cadastro é do administrador; o preposto que chega por link volta à lista.
  if (!escopo.ehAdmin) redirect("/clientes");
  const proposta =
    typeof orcamentoId === "string"
      ? await db.orcamento.findFirst({
          where: { id: orcamentoId, organizacaoId, clienteId: null },
          select: {
            id: true,
            numero: true,
            clienteAvulsoNome: true,
            clienteAvulsoMunicipio: true,
            representanteId: true,
          },
        })
      : null;

  const prepostos = await opcoesDeCarteira(
    escopo,
    proposta?.representanteId ? [proposta.representanteId] : [],
  );

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
            // A proposta de um preposto traz o cliente para a carteira dele.
            prepostoIds: proposta.representanteId ? [proposta.representanteId] : [],
          }}
          prepostos={prepostos}
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
        prepostos={prepostos}
        rotuloEnvio="Cadastrar cliente"
      />
    </Pagina>
  );
}
