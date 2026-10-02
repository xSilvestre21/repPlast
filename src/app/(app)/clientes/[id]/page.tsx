import { notFound } from "next/navigation";

import { Botao, BotaoLink, Cabecalho, Selo } from "@/components/ui";
import { diaDaColuna } from "@/lib/agenda";
import { hojeIso } from "@/lib/calendario";
import { escopoAtual } from "@/lib/sessao";

import { alternarAtivoCliente, atualizarCliente, excluirCliente } from "../acoes";
import { FormularioCliente } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoCodigos } from "./codigos";
import { SecaoCompromissos } from "./compromissos";
import { Building2, Pencil, UserRoundCheck, UserRoundX } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaCliente({
  params,
  searchParams,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const { organizacaoId, db, usuarioId } = await escopoAtual();
  const hoje = hojeIso();

  const [cliente, produtos, compromissos] = await Promise.all([
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
    // Os pendentes: os que vêm pela frente e os que passaram sem ser feitos.
    // O feito sai — está resolvido, e mora no calendário. O RLS deixa só os
    // de quem olha e os compartilhados.
    db.compromisso.findMany({
      where: { organizacaoId, clienteId: id, concluidoEm: null },
      orderBy: [{ data: "asc" }, { hora: "asc" }],
      take: 10,
      select: {
        id: true,
        titulo: true,
        data: true,
        hora: true,
        importancia: true,
        compartilhado: true,
        autorId: true,
        autor: { select: { nome: true } },
      },
    }),
  ]);

  if (!cliente) notFound();

  const parametros = await searchParams;
  /*
   * A ficha abre para LEITURA, como pedido e proposta gravados: uma tela que
   * já chega editável convida a mexer sem querer num cadastro que sai impresso
   * nos pedidos. Editável só quando se clicou em Editar (`?editar=1`).
   */
  const editavel = parametros.editar === "1";

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
            {!editavel && (
              <BotaoLink href={`/clientes/${cliente.id}?editar=1`} icone={Pencil}>
                Editar
              </BotaoLink>
            )}
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
          rotuloEnvio="Salvar e voltar"
          editavel={editavel}
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

        <SecaoCompromissos
          clienteId={cliente.id}
          hoje={hoje}
          compromissos={compromissos.map((c) => ({
            id: c.id,
            titulo: c.titulo,
            dia: diaDaColuna(c.data),
            hora: c.hora,
            importancia: c.importancia,
            compartilhado: c.compartilhado,
            meu: c.autorId === usuarioId,
            autor: c.autor.nome,
          }))}
        />
      </div>
    </Pagina>
  );
}
