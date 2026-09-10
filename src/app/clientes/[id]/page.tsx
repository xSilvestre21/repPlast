import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

import {
  atualizarCliente,
  excluirCliente,
  removerCodigoProduto,
  salvarCodigoProduto,
} from "../acoes";
import { FormularioCliente } from "../formulario";
import { BotaoExcluirCliente } from "./botao-excluir";
import { SecaoCodigos } from "./codigos";

export default async function PaginaCliente({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const [cliente, produtos] = await Promise.all([
    db.cliente.findFirst({
      where: { id, organizacaoId },
      include: {
        codigosProduto: {
          include: { produto: { select: { descricao: true } } },
          orderBy: { produto: { descricao: "asc" } },
        },
      },
    }),
    db.produto.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: [{ fornecedor: { nome: "asc" } }, { descricao: "asc" }],
      select: { id: true, descricao: true, fornecedor: { select: { nome: true } } },
    }),
  ]);

  if (!cliente) notFound();

  return (
    <>
      <Cabecalho
        titulo={cliente.apelido}
        descricao={cliente.razaoSocial}
        acao={
          <BotaoExcluirCliente
            apelido={cliente.apelido}
            acao={excluirCliente.bind(null, cliente.id)}
          />
        }
      />

      <div className="space-y-5">
        <FormularioCliente
          acao={atualizarCliente.bind(null, cliente.id)}
          rotuloEnvio="Salvar alterações"
          valores={{
            apelido: cliente.apelido,
            razaoSocial: cliente.razaoSocial,
            cnpj: cliente.cnpj ?? "",
            ie: cliente.ie ?? "",
            endereco: cliente.endereco ?? "",
            bairro: cliente.bairro ?? "",
            cep: cliente.cep ?? "",
            municipio: cliente.municipio ?? "",
            uf: cliente.uf ?? "",
            telefone: cliente.telefone ?? "",
            email: cliente.email ?? "",
            emailNfe: cliente.emailNfe ?? "",
            observacoes: cliente.observacoes ?? "",
          }}
        />

        <SecaoCodigos
          codigos={cliente.codigosProduto.map((c) => ({
            produtoId: c.produtoId,
            descricao: c.produto.descricao,
            codigo: c.codigo,
          }))}
          produtos={produtos.map((p) => ({
            id: p.id,
            descricao: p.descricao,
            fornecedor: p.fornecedor.nome,
          }))}
          salvar={salvarCodigoProduto.bind(null, cliente.id)}
          remover={removerCodigoProduto.bind(null, cliente.id)}
        />
      </div>
    </>
  );
}
