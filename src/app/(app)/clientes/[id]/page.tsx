import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { atualizarCliente, excluirCliente } from "../acoes";
import { FormularioCliente } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoCodigos } from "./codigos";
import { Building2 } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaCliente({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const { organizacaoId, db } = await escopoAtual();

  const [cliente, produtos] = await Promise.all([
    db.cliente.findFirst({ where: { id, organizacaoId } }),
    // Os produtos DELE. O dono é campo do produto, então a consulta é direta —
    // não há mais tabela de vínculo a atravessar.
    db.produto.findMany({
      where: { organizacaoId, clienteId: id, ativo: true },
      orderBy: [{ fornecedor: { nome: "asc" } }, { descricao: "asc" }],
      select: {
        id: true,
        descricao: true,
        codigoCliente: true,
        fornecedor: { select: { nome: true } },
      },
    }),
  ]);

  if (!cliente) notFound();

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        icone={Building2}
        titulo={cliente.apelido}
        descricao={cliente.razaoSocial}
        acao={
          <BotaoExcluir
            rotulo="Excluir cliente"
            nome={cliente.apelido}
            acao={excluirCliente.bind(null, cliente.id)}
          />
        }
      />

      <div className="space-y-5 palco">
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
          produtos={produtos.map((p) => ({
            id: p.id,
            descricao: p.descricao,
            fornecedor: p.fornecedor.nome,
            codigo: p.codigoCliente,
          }))}
        />
      </div>
    </Pagina>
  );
}
