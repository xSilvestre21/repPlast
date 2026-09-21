import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import {
  adicionarAditivo,
  atualizarFornecedor,
  excluirFornecedor,
  removerAditivo,
  removerLogo,
  definirPrepostosDaIndustria,
  removerMaterial,
  salvarLogo,
  salvarFaixasDoMaterial,
  salvarMaterial,
} from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { SecaoAditivos } from "./aditivos";
import { SecaoMateriais } from "./materiais";
import { SecaoPrepostos } from "./prepostos";
import { BotaoExcluir } from "@/components/botao-excluir";
import { SecaoLogo } from "./logo-industria";
import { Factory } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaFornecedor({ params }: PageProps<"/fornecedores/[id]">) {
  const { id } = await params;

  const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId },
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
    },
  });

  if (!fornecedor) notFound();

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
          select: { id: true, nome: true },
        })
      : [];

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/fornecedores", rotulo: "Fornecedores" }}
        icone={Factory}
        titulo={fornecedor.nome}
        descricao="Condições comerciais, logo e aditivos desta indústria."
        acao={
          <BotaoExcluir
            rotulo="Excluir indústria"
            nome={fornecedor.nome}
            aviso="Os aditivos dela serão removidos junto."
            acao={excluirFornecedor.bind(null, fornecedor.id)}
          />
        }
      />

      <div className="space-y-5 palco">
        <FormularioFornecedor
          acao={atualizarFornecedor.bind(null, fornecedor.id)}
          rotuloEnvio="Salvar alterações"
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
            emailsPedido: fornecedor.emailsPedido.join(", "),
            ipiPercentual: escreverNumeroBr(fornecedor.ipiPercentual.toString()),
            comissaoPercentual: escreverNumeroBr(fornecedor.comissaoPercentual.toString()),
            fatorKgPadrao: fornecedor.fatorKgPadrao
              ? escreverNumeroBr(fornecedor.fatorKgPadrao.toString(), 2)
              : "",
          }}
        />

        <SecaoLogo
          fornecedorId={fornecedor.id}
          nome={fornecedor.nome}
          temLogo={fornecedor.logoTipo !== null}
          versao={String(fornecedor.atualizadoEm.getTime())}
          salvar={salvarLogo.bind(null, fornecedor.id)}
          remover={removerLogo.bind(null, fornecedor.id)}
        />


        {prepostos.length > 0 && (
          <SecaoPrepostos
            prepostos={prepostos.map((p) => ({
              id: p.id,
              nome: p.nome,
              atende: fornecedor.prepostos.some((v) => v.usuarioId === p.id),
            }))}
            salvar={definirPrepostosDaIndustria.bind(null, fornecedor.id)}
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
        />
      </div>
    </Pagina>
  );
}
