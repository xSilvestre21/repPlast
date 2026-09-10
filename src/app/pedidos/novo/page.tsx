import { BotaoLink, Cabecalho, EstadoVazio } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

import { criarPedido } from "../acoes";
import { FormularioNovoPedido } from "./formulario";

export default async function PaginaNovoPedido() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const [clientes, fornecedores] = await Promise.all([
    db.cliente.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: { apelido: "asc" },
      select: { id: true, apelido: true, municipio: true, uf: true },
    }),
    db.fornecedor.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, ipiPercentual: true },
    }),
  ]);

  if (clientes.length === 0 || fornecedores.length === 0) {
    return (
      <>
        <Cabecalho
          titulo="Novo pedido"
          acao={
            <BotaoLink href={clientes.length === 0 ? "/clientes/novo" : "/fornecedores/novo"}>
              {clientes.length === 0 ? "Cadastrar cliente" : "Cadastrar indústria"}
            </BotaoLink>
          }
        />
        <EstadoVazio>
          Falta cadastrar {clientes.length === 0 ? "um cliente" : "uma indústria"} antes de lançar
          pedido.
        </EstadoVazio>
      </>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Novo pedido"
        descricao="O número é gerado na sequência desta indústria."
      />
      <FormularioNovoPedido
        acao={criarPedido}
        clientes={clientes.map((c) => ({
          id: c.id,
          rotulo: c.apelido,
          detalhe: c.municipio ? `${c.municipio}/${c.uf ?? ""}` : undefined,
        }))}
        fornecedores={fornecedores.map((f) => ({
          id: f.id,
          rotulo: f.nome,
          detalhe: `IPI ${Number(f.ipiPercentual).toLocaleString("pt-BR")}%`,
        }))}
      />
    </>
  );
}
