import { notFound } from "next/navigation";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { Botao, BotaoLink, Cabecalho, Selo } from "@/components/ui";
import { diaDaColuna } from "@/lib/agenda";
import { hojeIso } from "@/lib/calendario";
import { escopoAtual } from "@/lib/sessao";

import { alternarAtivoCliente, atualizarCliente, excluirCliente } from "../acoes";
import { opcoesDeCarteira } from "../carteira";
import { FormularioCliente } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoCodigos } from "./codigos";
import { SecaoCompromissos } from "./compromissos";
import { Building2, Pencil, UserRoundCheck, UserRoundX } from "lucide-react";
import { Pagina } from "@/components/pagina";
import { nomeCompleto } from "@/lib/nome-usuario";
import { recusaExcluirCliente } from "@/lib/recusa-exclusao";

export default async function PaginaCliente({
  params,
  searchParams,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const escopo = await escopoAtual();
  const { organizacaoId, db, usuarioId, ehAdmin } = escopo;
  const hoje = hojeIso();

  const [cliente, produtos, compromissos, propostas, todosOsProdutos, pedidos] = await Promise.all([
    db.cliente.findFirst({
      where: { id, organizacaoId },
      include: { prepostos: { select: { usuarioId: true } } },
    }),
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
        autor: { select: { nome: true, sobrenome: true } },
      },
    }),
    // O que a exclusão leva junto, para o aviso dizer antes de apagar.
    db.orcamento.count({ where: { organizacaoId, clienteId: id } }),
    db.produto.count({ where: { organizacaoId, clienteId: id } }),
    db.pedido.count({ where: { organizacaoId, clienteId: id } }),
  ]);

  if (!cliente) notFound();

  const atendem = cliente.prepostos.map((v) => v.usuarioId);
  const prepostos = await opcoesDeCarteira(escopo, atendem);

  const parametros = await searchParams;
  /*
   * A ficha abre para LEITURA, como pedido e proposta gravados: uma tela que
   * já chega editável convida a mexer sem querer num cadastro que sai impresso
   * nos pedidos. Editável só quando se clicou em Editar (`?editar=1`) — e
   * só para o administrador: o preposto consulta o cadastro, não mexe nele.
   */
  const editavel = ehAdmin && parametros.editar === "1";

  const avisoExclusao = [
    propostas > 0 &&
      (propostas === 1
        ? "A proposta dele volta a ser de quem ainda não é cliente."
        : `As ${propostas} propostas dele voltam a ser de quem ainda não é cliente.`),
    todosOsProdutos > 0 &&
      (todosOsProdutos === 1
        ? "O produto dele é apagado."
        : `Os ${todosOsProdutos} produtos dele são apagados.`),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        icone={Building2}
        titulo={cliente.apelido}
        descricao={cliente.razaoSocial}
        selo={!cliente.ativo ? <Selo tom="cancelado">Inativo</Selo> : undefined}
        acao={
          ehAdmin && (
          <div className="flex flex-wrap items-start gap-2">
            {!editavel && (
              <BotaoLink href={`/clientes/${cliente.id}?editar=1`} icone={Pencil}>
                Editar
              </BotaoLink>
            )}
            {/* Inativar é o caminho de quem parou de comprar: some das escolhas
                sem apagar nada. Excluir fica para o cadastro feito por engano. */}
            <AcaoComRecusa acao={alternarAtivoCliente.bind(null, cliente.id)} alinhamento="inicio">
              <Botao
                type="submit"
                variante="secundaria"
                icone={cliente.ativo ? UserRoundX : UserRoundCheck}
              >
                {cliente.ativo ? "Marcar como inativo" : "Reativar"}
              </Botao>
            </AcaoComRecusa>
            <BotaoExcluir
              rotulo="Excluir cliente"
              nome={cliente.apelido}
              aviso={avisoExclusao || undefined}
              impedimento={recusaExcluirCliente(pedidos)}
              acao={excluirCliente.bind(null, cliente.id)}
            />
          </div>
          )
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
          prepostos={prepostos}
          valores={{
            apelido: cliente.apelido,
            razaoSocial: cliente.razaoSocial,
            cnpj: cliente.cnpj ?? "",
            ie: cliente.ie ?? "",
            endereco: cliente.endereco ?? "",
            numero: cliente.numero ?? "",
            complemento: cliente.complemento ?? "",
            bairro: cliente.bairro ?? "",
            cep: cliente.cep ?? "",
            municipio: cliente.municipio ?? "",
            uf: cliente.uf ?? "",
            telefone: cliente.telefone ?? "",
            email: cliente.email ?? "",
            emailNfe: cliente.emailNfe ?? "",
            prazoPagamento: cliente.prazoPagamento ?? "",
            observacoes: cliente.observacoes ?? "",
            prepostoIds: atendem,
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
            autor: nomeCompleto(c.autor),
          }))}
        />
      </div>
    </Pagina>
  );
}
