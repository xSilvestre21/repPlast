import { notFound } from "next/navigation";

import { Botao, BotaoLink, Cabecalho, Selo } from "@/components/ui";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import {
  adicionarAditivo,
  alternarAtivoFornecedor,
  atualizarFornecedor,
  excluirFornecedor,
  removerAditivo,
  removerLogo,
  definirPrepostosDaIndustria,
  removerMaterial,
  salvarContatos,
  salvarLogo,
  salvarFaixasDoMaterial,
  salvarMaterial,
} from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { SecaoAditivos } from "./aditivos";
import { SecaoContatos } from "./contatos";
import { SecaoMateriais } from "./materiais";
import { SecaoPrepostos } from "./prepostos";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoLogo } from "./logo-industria";
import { Check, CircleCheck, CircleOff, Factory, Pencil } from "lucide-react";
import { Pagina } from "@/components/pagina";
import { nomeCompleto } from "@/lib/nome-usuario";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";

export default async function PaginaFornecedor({
  params,
  searchParams,
}: PageProps<"/fornecedores/[id]">) {
  const { id } = await params;

  const { organizacaoId, usuarioId, db, ehAdmin, plano } = await escopoAtual();

  const fornecedor = await db.fornecedor.findFirst({
    // A indústria só legível por um pedido (ver `soIndustriasMarcadas`) não
    // abre a ficha: o preposto vê o nome no pedido, não o cadastro dela.
    where: { id, organizacaoId, ...soIndustriasMarcadas({ ehAdmin, usuarioId }) },
    // `omit` do logo: são bytes que não têm uso nesta página, e trazê-los a
    // cada carregamento seria desperdício. A imagem vem pela rota própria.
    omit: { logo: true },
    include: {
      aditivos: { orderBy: { nome: "asc" } },
      materiais: {
        orderBy: { nome: "asc" },
        include: { faixas: { orderBy: [{ pesoDeKg: "asc" }] } },
      },
      prepostos: { select: { usuarioId: true } },
      contatos: { orderBy: { ordem: "asc" } },
    },
  });

  if (!fornecedor) notFound();

  const parametros = await searchParams;
  /*
   * A ficha abre para LEITURA, como a do cliente e a do produto: IPI, comissão
   * e preço de material entram na conta de todo pedido, e uma tela que já chega
   * editável convida a mexer sem querer. Editável só quando se clicou em Editar
   * (`?editar=1`) — e só para o administrador: o preposto consulta o
   * cadastro, não mexe nele.
   */
  const editavel = ehAdmin && parametros.editar === "1";

  /*
   * A seção de quem atende só faz sentido para o administrador de um escritório
   * Plus com preposto inscrito. Fora disso, é uma caixa vazia perguntando algo
   * que não se aplica.
   */
  const prepostos =
    ehAdmin && plano === "PLUS"
      ? await db.usuario.findMany({
          where: { organizacaoId, papel: "REPRESENTANTE", ativo: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true, sobrenome: true },
        }).then((lista) => lista.map((u) => ({ ...u, nome: nomeCompleto(u) })))
      : [];

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/fornecedores", rotulo: "Fornecedores" }}
        icone={Factory}
        titulo={fornecedor.nome}
        descricao="Condições comerciais, logo e aditivos desta indústria."
        selo={!fornecedor.ativo ? <Selo tom="cancelado">Inativa</Selo> : undefined}
        acao={
          ehAdmin && (
          <div className="flex flex-wrap gap-2">
            {/* Cada seção desta ficha salva sozinha, então editar não termina
                necessariamente no botão do formulário de cima: "Concluir" é a
                saída de quem só mexeu num contato ou num preço de material. */}
            {editavel ? (
              <BotaoLink
                href={`/fornecedores/${fornecedor.id}`}
                icone={Check}
                variante="secundaria"
              >
                Concluir edição
              </BotaoLink>
            ) : (
              <BotaoLink href={`/fornecedores/${fornecedor.id}?editar=1`} icone={Pencil}>
                Editar
              </BotaoLink>
            )}
            {/* Inativar é o caminho da representação que acabou: some das
                escolhas sem apagar nada. Excluir fica para o cadastro feito por
                engano — e nem é possível depois que há produto. */}
            <form action={alternarAtivoFornecedor.bind(null, fornecedor.id)}>
              <Botao
                type="submit"
                variante="secundaria"
                icone={fornecedor.ativo ? CircleOff : CircleCheck}
              >
                {fornecedor.ativo ? "Marcar como inativa" : "Reativar"}
              </Botao>
            </form>
            <BotaoExcluir
              rotulo="Excluir indústria"
              nome={fornecedor.nome}
              aviso="Os aditivos dela serão removidos junto."
              acao={excluirFornecedor.bind(null, fornecedor.id)}
            />
          </div>
          )
        }
      />

      {/*
        A `key` remonta tudo ao trocar de modo. Ir de edição para leitura é uma
        navegação sem recarregar, e sem isto o que foi digitado e NÃO salvo
        continuaria nos campos — a ficha de leitura mostrando o que não está
        gravado.
      */}
      <div key={editavel ? "edicao" : "leitura"} className="space-y-5 palco">
        {!fornecedor.ativo && (
          // Neutro, e não vermelho: inativa é situação, não erro.
          <p className="rounded-suave border border-filete bg-folha-2 px-4 py-3 text-corpo text-tinta-2">
            Indústria inativa: não aparece ao criar pedido, proposta ou produto, nem na lista
            padrão de fornecedores. Pedidos, propostas e produtos dela continuam como estão.
          </p>
        )}

        <FormularioFornecedor
          acao={atualizarFornecedor.bind(null, fornecedor.id)}
          rotuloEnvio="Salvar alterações"
          editavel={editavel}
          valores={{
            nome: fornecedor.nome,
            razaoSocial: fornecedor.razaoSocial ?? "",
            cnpj: fornecedor.cnpj ?? "",
            endereco: fornecedor.endereco ?? "",
            bairro: fornecedor.bairro ?? "",
            cep: fornecedor.cep ?? "",
            municipio: fornecedor.municipio ?? "",
            uf: fornecedor.uf ?? "",
            telefone: fornecedor.telefone ?? "",
            email: fornecedor.email ?? "",
            ipiPercentual: escreverNumeroBr(fornecedor.ipiPercentual.toString()),
            comissaoPercentual: escreverNumeroBr(fornecedor.comissaoPercentual.toString()),
            fatorKgPadrao: fornecedor.fatorKgPadrao
              ? escreverNumeroBr(fornecedor.fatorKgPadrao.toString(), 2)
              : "",
          }}
        />

        {/*
          A `key` muda quando a lista salva muda, e remonta a seção com os ids que
          o banco deu às linhas novas — sem isso, salvar de novo as recriaria.
        */}
        <SecaoContatos
          key={fornecedor.contatos.map((c) => `${c.id}:${c.email}:${c.padrao}`).join("|")}
          contatos={fornecedor.contatos.map((c) => ({
            id: c.id,
            nome: c.nome ?? "",
            setor: c.setor ?? "",
            email: c.email,
            padrao: c.padrao,
          }))}
          salvar={salvarContatos.bind(null, fornecedor.id)}
          editavel={editavel}
        />

        <SecaoLogo
          fornecedorId={fornecedor.id}
          nome={fornecedor.nome}
          temLogo={fornecedor.logoTipo !== null}
          versao={String(fornecedor.atualizadoEm.getTime())}
          salvar={salvarLogo.bind(null, fornecedor.id)}
          remover={removerLogo.bind(null, fornecedor.id)}
          editavel={editavel}
        />


        {prepostos.length > 0 && (
          <SecaoPrepostos
            prepostos={prepostos.map((p) => ({
              id: p.id,
              nome: p.nome,
              atende: fornecedor.prepostos.some((v) => v.usuarioId === p.id),
            }))}
            salvar={definirPrepostosDaIndustria.bind(null, fornecedor.id)}
            editavel={editavel}
          />
        )}

        <SecaoMateriais
          materiais={fornecedor.materiais.map((m) => ({
            id: m.id,
            nome: m.nome,
            precoKg: escreverNumeroBr(m.precoKg.toString(), 2),
            precoMinimoKg: m.precoMinimoKg ? escreverNumeroBr(m.precoMinimoKg.toString(), 2) : "",
            densidade: m.densidade ? escreverNumeroBr(m.densidade.toString()) : "",
            faixas: m.faixas.map((f) => ({
              pesoDeKg: f.pesoDeKg ? escreverNumeroBr(f.pesoDeKg.toString()) : "",
              pesoAteKg: f.pesoAteKg ? escreverNumeroBr(f.pesoAteKg.toString()) : "",
              precoKg: escreverNumeroBr(f.precoKg.toString(), 2),
            })),
          }))}
          salvar={salvarMaterial.bind(null, fornecedor.id)}
          salvarFaixas={salvarFaixasDoMaterial.bind(null, fornecedor.id)}
          remover={removerMaterial.bind(null, fornecedor.id)}
          editavel={editavel}
        />

        <SecaoAditivos
          aditivos={fornecedor.aditivos.map((a) => ({
            id: a.id,
            nome: a.nome,
            sufixoDescricao: a.sufixoDescricao,
            tipo: a.tipo,
            valor: a.valor.toString(),
          }))}
          adicionar={adicionarAditivo.bind(null, fornecedor.id)}
          remover={removerAditivo.bind(null, fornecedor.id)}
          editavel={editavel}
        />
      </div>
    </Pagina>
  );
}
