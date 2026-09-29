import { notFound } from "next/navigation";

import { Botao, Cabecalho, Selo } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { alternarAtivoCliente, atualizarCliente, excluirCliente } from "../acoes";
import { FormularioCliente } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoCodigos } from "./codigos";
import { Building2, UserRoundCheck, UserRoundX } from "lucide-react";
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
        selo={!cliente.ativo ? <Selo tom="cancelado">Inativo</Selo> : undefined}
        acao={
          <div className="flex flex-wrap gap-2">
            {/* Inativar é o caminho de quem parou de comprar: some das escolhas
                sem apagar nada. Excluir fica para o cadastro feito por engano. */}
            <form action={alternarAtivoCliente.bind(null, cliente.id)}>
              <Botao
                type="submit"
                variante="secundaria"
                icone={cliente.ativo ? UserRoundX : UserRoundCheck}
              >
                {cliente.ativo ? "Marcar como inativo" : "Reativar"}
              </Botao>
            </form>
            <BotaoExcluir
              rotulo="Excluir cliente"
              nome={cliente.apelido}
              acao={excluirCliente.bind(null, cliente.id)}
            />
          </div>
        }
      />

      <div className="space-y-5 palco">
        {!cliente.ativo && (
          // Neutro, e não vermelho: inativo é situação, não erro.
          <p className="rounded-suave border border-filete bg-folha-2 px-4 py-3 text-corpo text-tinta-2">
            Cliente inativo: não aparece ao criar pedido ou proposta, nem na lista padrão de
            clientes. Pedidos e propostas dele continuam como estão.
          </p>
        )}

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
            prazoPagamento: cliente.prazoPagamento ?? "",
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
