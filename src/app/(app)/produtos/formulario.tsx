"use client";

import {
  CircleDot,
  Disc3,
  Factory,
  FileText,
  FlaskConical,
  Layers,
  Package,
  Ruler,
  Search,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Campo,
  Cartao,
  MensagemErro,
  SecaoCartao,
  Selecao,
  formatarMoeda,
} from "@/components/ui";
import { SelecaoBuscavel, achatar } from "@/components/selecao-buscavel";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { lerNumeroBr } from "@/lib/numero-br";
import { unidadeDoRotulo } from "@/lib/produto-preco";
import {
  DENSIDADE_PADRAO,
  type Aditivo,
  faltaParaOMinimo,
  fatorEfetivo,
  pesoMilheiroKg,
  precoMilheiroSaco,
} from "@/lib/precificacao";

import type { EstadoFormulario } from "./acoes";
import type { ValoresProduto } from "./valores";

export type AditivoOpcao = Aditivo & { id: string };

export type MaterialOpcao = {
  nome: string;
  precoKg: string;
  precoMinimoKg: string | null;
  densidade: string | null;
};

export type FornecedorOpcao = {
  id: string;
  nome: string;
  fatorKgPadrao: string | null;
  comissaoPercentual: string;
  aditivos: AditivoOpcao[];
  materiais: MaterialOpcao[];
};

/** id do <datalist> com os materiais da indústria escolhida. */

/**
 * O que se escolhe na tela: o TIPO, não a família — os mesmos `TIPOS` do item
 * por conta da proposta.
 *
 * Quase sempre são a mesma coisa. O shrink é a exceção: o representante vende
 * e fala dele como coisa própria, mas no cadastro ele é STRETCH — por kg, sem
 * medida de saco —, que é como a importação do SICOV já o grava. O tipo vive
 * só na tela; o que vai para o servidor é a família.
 *
 * `nome` é o que abre a descrição impressa. Vem preenchido para a descrição se
 * montar sozinha; o saco não tem, porque ali o que abre são as medidas e o
 * material vem depois.
 */
const TIPOS = [
  { valor: "SACO", familia: "SACO", rotulo: "Saco plástico", nome: "" },
  { valor: "FITA", familia: "FITA", rotulo: "Fita", nome: "Fita adesiva" },
  { valor: "STRETCH", familia: "STRETCH", rotulo: "Stretch", nome: "FILME STRETCH" },
  { valor: "SHRINK", familia: "STRETCH", rotulo: "Shrink", nome: "FILME SHRINK" },
  { valor: "BOBINA", familia: "BOBINA", rotulo: "Bobina", nome: "BOBINA" },
  { valor: "AVULSO", familia: "AVULSO", rotulo: "Avulso", nome: "" },
] as const;

type Tipo = (typeof TIPOS)[number];

const tipoPorValor = (valor: string): Tipo => TIPOS.find((t) => t.valor === valor) ?? TIPOS[0];

/**
 * O tipo de um produto já gravado.
 *
 * O shrink não tem marca própria no banco — é um STRETCH —, então é
 * reconhecido pelo nome: os importados trazem "Shrink" na descrição e o
 * material vazio; os cadastrados aqui, "FILME SHRINK" no material.
 */
function tipoDoProduto(valores: ValoresProduto): Tipo {
  if (valores.familia === "STRETCH" && /shrink/i.test(`${valores.material} ${valores.descricao}`)) {
    return tipoPorValor("SHRINK");
  }
  return tipoPorValor(valores.familia);
}

/**
 * Como a fita é vendida — escolhido ANTES dos preços, para a tela pedir só o
 * que a conta usa. Os três primeiros são os do item por conta da proposta
 * (`MODOS_FITA` em `conta-item.tsx`).
 *
 * O quarto existe por causa do cadastro: a fita com preço de caixa E preço de
 * unidade próprios, vendável das duas formas no pedido. É como vieram fitas do
 * sistema anterior, e cair em qualquer um dos outros apagaria um dos preços.
 */
const MODOS_FITA = [
  { valor: "CAIXA", rotulo: "Caixa", campos: ["precoCaixa"] },
  {
    valor: "CAIXA_POR_UNIDADE",
    rotulo: "Caixa, pelo preço da unidade",
    campos: ["precoUnidade", "unidadesPorCaixa"],
  },
  { valor: "UNIDADE", rotulo: "Unidade", campos: ["precoUnidade"] },
  {
    valor: "CAIXA_E_UNIDADE",
    rotulo: "Caixa e unidade",
    campos: ["precoCaixa", "precoUnidade", "unidadesPorCaixa"],
  },
] as const satisfies readonly {
  valor: string;
  rotulo: string;
  campos: readonly ("precoCaixa" | "precoUnidade" | "unidadesPorCaixa")[];
}[];

type ModoFita = (typeof MODOS_FITA)[number];

/** O modo de uma fita já gravada, lido do que está preenchido nela. */
function modoDaFita(valores: ValoresProduto): ModoFita {
  const caixa = valores.precoCaixa.trim() !== "";
  const unidade = valores.precoUnidade.trim() !== "";
  const porCaixa = valores.unidadesPorCaixa.trim() !== "";

  const valor =
    caixa && unidade
      ? "CAIXA_E_UNIDADE"
      : caixa
        ? "CAIXA"
        : unidade && porCaixa
          ? "CAIXA_POR_UNIDADE"
          : unidade
            ? "UNIDADE"
            : "CAIXA";
  return MODOS_FITA.find((m) => m.valor === valor) ?? MODOS_FITA[0];
}

/** O avulso é vendido na unidade que se escolher; as outras famílias têm a sua. */
const UNIDADES_AVULSO = [
  { valor: "UN", rotulo: "Unidade" },
  { valor: "KG", rotulo: "Quilo" },
  { valor: "CX", rotulo: "Caixa" },
  { valor: "MIL", rotulo: "Milheiro" },
] as const;

/** Até quantos aditivos as etiquetas bastam; acima disso aparece a busca. */
const LIMITE_SEM_BUSCA = 6;

/** `detalhe` desempata apelidos parecidos: a cidade, ou "inativo" para o dono antigo. */
export type ClienteOpcao = { id: string; apelido: string; detalhe?: string };

export function FormularioProduto({
  fornecedores,
  clientes,
  valores,
  acao,
  rotuloEnvio,
  editavel = true,
}: {
  fornecedores: FornecedorOpcao[];
  clientes: ClienteOpcao[];
  valores: ValoresProduto;
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  rotuloEnvio: string;
  /** Ficha já gravada, aberta para leitura: tudo travado até clicar em Editar. */
  editavel?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  const opcoesIndustria = useMemo(
    () => fornecedores.map((f) => ({ id: f.id, rotulo: f.nome })),
    [fornecedores],
  );
  // "Sem cliente" é uma opção como as outras, e a primeira: é o que deixa
  // desfazer a escolha num campo que não tem um vazio para onde voltar.
  const opcoesCliente = useMemo(
    () => [
      { id: "", rotulo: "Sem cliente" },
      ...clientes.map((c) => ({ id: c.id, rotulo: c.apelido, detalhe: c.detalhe })),
    ],
    [clientes],
  );

  const [campos, setCampos] = useState<ValoresProduto>(valores);
  /** Descrição digitada à mão. `null` = seguir a gerada automaticamente. */
  const [descricaoManual, setDescricaoManual] = useState<string | null>(
    // Ao editar um produto já salvo, respeita o que está gravado.
    valores.descricao ? valores.descricao : null,
  );

  const alterar = (campo: keyof ValoresProduto) => (valor: string) =>
    setCampos((atual) => ({ ...atual, [campo]: valor }));

  const [modoFita, setModoFita] = useState<ModoFita>(() => modoDaFita(valores));

  /*
   * Na fita, só vai ao servidor o que o modo mostra: o campo escondido não
   * está no formulário, e `dadosDoFormulario` grava nulo no lugar. O que foi
   * digitado em outro modo fica guardado aqui — voltar a ele traz de volta.
   */
  const usaNaFita = (campo: ModoFita["campos"][number]) =>
    (modoFita.campos as readonly string[]).includes(campo);

  const [tipo, setTipo] = useState<Tipo>(() => tipoDoProduto(valores));

  const opcoesTipo = useMemo(() => TIPOS.map((t) => ({ id: t.valor, rotulo: t.rotulo })), []);

  /**
   * Troca o tipo e, com ele, a família e o nome que abre a descrição.
   *
   * Só reescreve o nome se ele ainda for o padrão do tipo anterior (ou vazio):
   * o que a pessoa digitou ali — "Fita adesiva marrom" — é dela, e trocar de
   * tipo não pode apagar. Saindo do saco, reescreve sempre: ali o campo é o
   * material da tabela (PEAD), que não tem o que fazer abrindo a descrição de
   * uma fita ou de um shrink.
   */
  function escolherTipo(valor: string) {
    const novo = tipoPorValor(valor);

    setCampos((atual) => ({
      ...atual,
      familia: novo.familia,
      // A unidade era da família anterior: "KG" de um saco não diz nada de uma
      // fita. Trocar de tipo sem trocar de família (stretch ↔ shrink) mantém.
      unidadeRotulo: novo.familia === atual.familia ? atual.unidadeRotulo : "",
      material:
        tipo.valor === "SACO" || atual.material.trim() === "" || atual.material === tipo.nome
          ? novo.nome
          : atual.material,
    }));
    setTipo(novo);
  }

  /**
   * A densidade que ESTE formulário preencheu sozinho na última escolha de
   * material.
   *
   * Guardada para saber se o que está no campo ainda é a sugestão ou já foi
   * mexido à mão. Sem isso, trocar o material teria de escolher entre dois
   * defeitos: nunca atualizar (e deixar a densidade do material anterior) ou
   * sempre sobrescrever (e apagar um ajuste que a pessoa acabou de digitar).
   *
   * O fator kg NÃO entra aqui: ele nunca é preenchido, só sugerido pelo
   * placeholder do campo.
   */
  const [densidadeSugerida, setDensidadeSugerida] = useState("");

  // Memoizado porque `?? []` criaria um array novo a cada render, o que
  // invalidaria as memoizações seguintes — inclusive a do cálculo do preço.
  const aditivosDisponiveis = useMemo(
    () => fornecedores.find((f) => f.id === campos.fornecedorId)?.aditivos ?? [],
    [fornecedores, campos.fornecedorId],
  );

  const materiaisDisponiveis = useMemo(
    () => fornecedores.find((f) => f.id === campos.fornecedorId)?.materiais ?? [],
    [fornecedores, campos.fornecedorId],
  );

  /*
   * As opções do Material do saco: a tabela da indústria, uma vez cada nome (a
   * tabela pode repetir), com o preço do kg ao lado. O material gravado que não
   * está nela — produto antigo, ou indústria trocada — entra também, marcado:
   * fora da lista ele sumiria da caixa e seria regravado sem ninguém ver.
   */
  const opcoesMaterial = useMemo(() => {
    const opcoes = materiaisDisponiveis
      .filter((m, i, todos) => todos.findIndex((o) => o.nome === m.nome) === i)
      .map((m) => ({
        id: m.nome,
        rotulo: m.nome,
        detalhe: `${formatarMoeda(Number(m.precoKg))} / kg`,
      }));

    const atual = campos.material.trim();
    return atual && !opcoes.some((o) => o.id.toLowerCase() === atual.toLowerCase())
      ? [{ id: campos.material, rotulo: campos.material, detalhe: "fora da tabela" }, ...opcoes]
      : opcoes;
  }, [materiaisDisponiveis, campos.material]);

  /**
   * O material digitado, quando é um da tabela de preços desta indústria.
   *
   * Memoizado pelo mesmo motivo das listas acima: ele alimenta a dependência do
   * cálculo de preço, e um objeto novo a cada tecla invalidaria aquela
   * memoização.
   */
  const materialDaTabela = useMemo(
    () =>
      materiaisDisponiveis.find(
        (m) => m.nome.toLowerCase() === campos.material.trim().toLowerCase(),
      ),
    [materiaisDisponiveis, campos.material],
  );

  /** Piso do material escolhido, quando ele tem um. */
  const minimoDoMaterial = materialDaTabela?.precoMinimoKg ?? null;

  /*
   * Percentual da indústria, para dimensionar o aviso de piso. É aproximação de
   * propósito: o pedido pode sobrepor este percentual, e aqui ainda não há
   * pedido nenhum.
   */
  const comissaoBruta = fornecedores.find((f) => f.id === campos.fornecedorId)
    ?.comissaoPercentual;
  const comissaoDaIndustria =
    comissaoBruta && Number(comissaoBruta) > 0 ? Number(comissaoBruta) : null;

  /*
   * A busca dos aditivos. Uma indústria chega a ter quase trinta, e achar o
   * "anti-UV" no meio de trinta etiquetas é ler todas.
   *
   * O escolhido continua na tela qualquer que seja a busca, e não só por
   * conforto: etiqueta que some não vai no formulário, e salvar desmarcaria em
   * silêncio um aditivo que ninguém tirou.
   */
  const [buscaAditivo, setBuscaAditivo] = useState("");

  const aditivosVisiveis = useMemo(() => {
    const termos = achatar(buscaAditivo).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return aditivosDisponiveis;
    return aditivosDisponiveis.filter((a) => {
      if (campos.aditivos.includes(a.id)) return true;
      const alvo = achatar(`${a.nome} ${a.sufixoDescricao}`);
      return termos.every((termo) => alvo.includes(termo));
    });
  }, [aditivosDisponiveis, buscaAditivo, campos.aditivos]);

  const aditivosEscolhidos = useMemo(
    () => aditivosDisponiveis.filter((a) => campos.aditivos.includes(a.id)),
    [aditivosDisponiveis, campos.aditivos],
  );

  const sufixos = aditivosEscolhidos.map((a) => a.sufixoDescricao);

  const descricaoGerada = useMemo(() => {
    if (campos.familia === "SACO") {
      const largura = lerNumeroBr(campos.larguraCm);
      const comprimento = lerNumeroBr(campos.comprimentoCm);
      const espessura = lerNumeroBr(campos.espessuraMm);

      if (largura === null || comprimento === null || espessura === null) return "";

      return descricaoSaco({
        larguraCm: largura,
        comprimentoCm: comprimento,
        espessuraMm: espessura,
        sanfona: campos.sanfona,
        material: campos.material,
        complemento: campos.complemento,
        adicionais: sufixos,
      });
    }

    if (campos.familia === "FITA") {
      return descricaoFita({
        material: campos.material,
        larguraMm: lerNumeroBr(campos.larguraMm),
        metragemM: lerNumeroBr(campos.metragemM),
        complemento: campos.complemento,
        adicionais: sufixos,
      });
    }

    return descricaoRolo({
      material: campos.material,
      larguraMm: lerNumeroBr(campos.larguraMm),
      micragem: lerNumeroBr(campos.micragem),
      complemento: campos.complemento,
      adicionais: sufixos,
    });
  }, [campos, sufixos]);

  const descricao = descricaoManual ?? descricaoGerada;
  const descricaoDivergente =
    descricaoManual !== null && descricaoGerada !== "" && descricaoManual !== descricaoGerada;

  /** Cálculo ao vivo do saco, com a mesma função que o pedido vai usar. */
  /** O preço do quilo do saco vendido por kg: o fator, mais os aditivos por kg. */
  const precoDoKg = useMemo(() => {
    const fator = lerNumeroBr(campos.fatorKg);
    return fator === null ? null : fatorEfetivo(fator, aditivosEscolhidos);
  }, [campos.fatorKg, aditivosEscolhidos]);

  /** Quanto o quilo fica abaixo do piso do material — `null` no caso normal. */
  const faltaNoKg = (() => {
    const fator = lerNumeroBr(campos.fatorKg);
    const minimo = minimoDoMaterial === null ? null : Number(minimoDoMaterial);
    return fator === null || minimo === null || fator >= minimo ? null : minimo - fator;
  })();

  const calculo = useMemo(() => {
    if (campos.familia !== "SACO") return null;

    const largura = lerNumeroBr(campos.larguraCm);
    const comprimento = lerNumeroBr(campos.comprimentoCm);
    const espessura = lerNumeroBr(campos.espessuraMm);
    const fator = lerNumeroBr(campos.fatorKg);

    if (largura === null || comprimento === null || espessura === null || fator === null) {
      return null;
    }

    const aditivosCalc: Aditivo[] = aditivosEscolhidos;
    // Campo vazio é ausência, não zero: o motor cai em DENSIDADE_PADRAO.
    const densidade = lerNumeroBr(campos.densidade);

    return {
      largura,
      comprimento,
      espessura,
      fator,
      densidade: densidade ?? DENSIDADE_PADRAO.toNumber(),
      pesoMilheiro: pesoMilheiroKg(
        { larguraCm: largura, comprimentoCm: comprimento, espessuraMm: espessura },
        densidade,
      ),
      fatorEfetivo: fatorEfetivo(fator, aditivosCalc),
      precoMilheiro: precoMilheiroSaco({
        larguraCm: largura,
        comprimentoCm: comprimento,
        espessuraMm: espessura,
        fatorKg: fator,
        densidade,
        aditivos: aditivosCalc,
      }),
      /*
       * Quanto o milheiro deixa de render por estar abaixo do piso do material.
       * `null` é o caso normal — fator no piso ou acima.
       */
      falta:
        minimoDoMaterial === null
          ? null
          : faltaParaOMinimo(
              { larguraCm: largura, comprimentoCm: comprimento, espessuraMm: espessura },
              densidade,
              fator,
              minimoDoMaterial,
            ),
    };
  }, [campos, aditivosEscolhidos, minimoDoMaterial]);

  const ehSaco = campos.familia === "SACO";
  const ehFita = campos.familia === "FITA";
  const ehAvulso = campos.familia === "AVULSO";
  const ehShrink = tipo.valor === "SHRINK";

  /*
   * Como o saco é vendido. Mora no rótulo de unidade do produto — o mesmo
   * texto que veio do SICOV ("MIL", "Kg") —, e é ele que faz o item já abrir
   * em KG no pedido. Vazio é milheiro, o caso de quase todo saco.
   */
  const unidadeDoSaco = unidadeDoRotulo(campos.unidadeRotulo);
  const sacoPorKg = ehSaco && unidadeDoSaco === "KG";
  const rotuloLegado =
    campos.unidadeRotulo.trim() && unidadeDoSaco !== "MIL" && unidadeDoSaco !== "KG"
      ? campos.unidadeRotulo
      : null;

  /**
   * Escreve o material e, sendo ele um da tabela da indústria, traz a densidade
   * junto.
   *
   * O fator kg fica de fora de propósito: o valor da tabela aparece como
   * PLACEHOLDER do campo, e digitar continua sendo do usuário. É ele quem
   * negocia o preço — o cadastro lembra quanto está na tabela, não decide.
   */
  function escolherMaterial(texto: string) {
    // No saco a indústria imprime em maiúsculo; nas outras famílias os pedidos
    // reais trazem "Fita adesiva", com caixa mista.
    const nome = ehSaco ? texto.toUpperCase() : texto;
    const escolhido = materiaisDisponiveis.find(
      (m) => m.nome.toLowerCase() === nome.trim().toLowerCase(),
    );

    if (!ehSaco || !escolhido) {
      setCampos((atual) => ({ ...atual, material: nome }));
      return;
    }

    const novaDensidade = escolhido.densidade ? formatarNumero(escolhido.densidade) : "";

    setCampos((atual) => ({
      ...atual,
      material: nome,
      // Preserva o que foi ajustado à mão; só reescreve a própria sugestão.
      densidade:
        atual.densidade === "" || atual.densidade === densidadeSugerida
          ? novaDensidade
          : atual.densidade,
    }));
    setDensidadeSugerida(novaDensidade);
  }

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      {/*
        Em leitura, o formulário inteiro trava de uma vez — mesmo recurso do
        cabeçalho do pedido. Mexer exige clicar em Editar no alto da página.
      */}
      <fieldset disabled={!editavel} className="space-y-5 min-w-0">
        <SecaoCartao icone={Factory} titulo="Origem">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelecaoBuscavel
              name="fornecedorId"
              rotulo="Indústria"
              required
              opcoes={opcoesIndustria}
              value={campos.fornecedorId}
              placeholder="Digite para achar…"
              aoEscolher={(novo) => {
                // Trocar de indústria invalida os aditivos escolhidos, que são
                // dela; e sugere o fator kg padrão quando ainda não há um.
                const sugestao = fornecedores.find((f) => f.id === novo)?.fatorKgPadrao;
                const padrao = sugestao ? formatarNumero(sugestao, 2) : "";

                setCampos((atual) => ({
                  ...atual,
                  fornecedorId: novo,
                  aditivos: [],
                  fatorKg: atual.fatorKg || padrao,
                }));
                // A densidade sugerida era da OUTRA indústria; deixá-la de pé
                // faria o campo parecer mexido à mão e travaria a sugestão do
                // material daqui em diante.
                setDensidadeSugerida("");
              }}
            />

            {/*
              De quem é o produto.

              O mesmo saco cotado para dois clientes são dois produtos, com preço
              próprio — e é o cliente que distingue as linhas de descrição
              idêntica no catálogo. Fica vazio só para item de prateleira.
            */}
            <SelecaoBuscavel
              name="clienteId"
              rotulo="Cliente"
              opcoes={opcoesCliente}
              value={campos.clienteId}
              placeholder="Digite para achar…"
              aoEscolher={alterar("clienteId")}
              dica="Deixe em “Sem cliente” se for item de catálogo, sem dono."
            />

            <SelecaoBuscavel
              name="tipo"
              rotulo="Tipo"
              required
              opcoes={opcoesTipo}
              value={tipo.valor}
              aoEscolher={escolherTipo}
              dica={
                ehSaco
                  ? "Só o saco tem preço calculado por fórmula."
                  : ehAvulso
                    ? "Para o que não é saco, fita, stretch nem bobina."
                    : ehShrink
                      ? "Vendido por kg; entra no cadastro como stretch."
                      : "Preço de tabela."
              }
            />
            <input type="hidden" name="familia" value={campos.familia} />
            {/* Fora do saco a unidade não se escolhe aqui, mas é do produto e
                precisa voltar como veio — sem isto, salvar a apagava. */}
            {!ehSaco && (
              <input type="hidden" name="unidadeRotulo" value={campos.unidadeRotulo} />
            )}

            <Campo
              name="codigoFornecedor"
              rotulo="Código na indústria"
              dica="Sai na coluna COD.FORN do pedido."
              value={campos.codigoFornecedor}
              onChange={(e) => alterar("codigoFornecedor")(e.target.value)}
            />

            <Campo
              name="codigoCliente"
              rotulo="Código no cliente"
              dica="Sai na coluna COD.CLI. Opcional — nem todo cliente numera o que compra."
              value={campos.codigoCliente}
              onChange={(e) => alterar("codigoCliente")(e.target.value)}
            />

            {/*
              No saco, material é a tabela de preço da indústria: escolhe-se
              dela, digitando. Nas outras famílias o campo abre a descrição com
              texto livre ("Fita adesiva"), e oferecer PEAD ali só atrapalharia.
            */}
            {ehSaco ? (
              <SelecaoBuscavel
                name="material"
                rotulo="Material"
                opcoes={opcoesMaterial}
                value={campos.material}
                aoEscolher={escolherMaterial}
                placeholder={campos.fornecedorId ? "Digite para achar…" : "Escolha a indústria antes"}
                vazio={
                  campos.fornecedorId
                    ? "Nenhum material da tabela desta indústria com esse nome."
                    : "Escolha a indústria: o material vem da tabela dela."
                }
                dica={
                  materialDaTabela
                    ? `Tabela desta indústria: ${formatarMoeda(materialDaTabela.precoKg)} / kg.`
                    : campos.material
                      ? "Fora da tabela desta indústria — o fator kg fica sem sugestão."
                      : "Sai depois das medidas, como PEAD no pedido 2253."
                }
              />
            ) : (
              <Campo
                name="material"
                rotulo="Tipo do produto"
                dica="Abre a descrição, como “Fita adesiva” ou “FILM STRETCH”."
                placeholder={tipo.nome || "Nome do item"}
                value={campos.material}
                onChange={(e) => escolherMaterial(e.target.value)}
              />
            )}

            <Campo
              name="complemento"
              rotulo="Complemento"
              dica="Fecha a descrição: cor, acabamento, peso da bobina."
              placeholder={
                ehSaco
                  ? ""
                  : ehFita
                    ? "transparente"
                    : ehAvulso
                      ? ""
                      : ehShrink
                        ? "BOBINA COM 20 KG"
                        : "BOBINA 4KG PESO LÍQUIDO"
              }
              value={campos.complemento}
              onChange={(e) => alterar("complemento")(e.target.value)}
              className="sm:col-span-2"
            />
          </div>
        </SecaoCartao>

        {ehSaco && (
          <SecaoCartao
            icone={Ruler}
            titulo="Medidas"
            descricao={
              sacoPorKg
                ? "Por quilo, o preço é o do kg; as medidas formam a descrição. A sanfona entra só nela."
                : "São elas que formam o preço. A sanfona entra só na descrição."
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Selecao
                name="unidadeRotulo"
                rotulo="Vendido por"
                value={sacoPorKg ? "KG" : (rotuloLegado ?? "MIL")}
                onChange={(e) => alterar("unidadeRotulo")(e.target.value)}
                dica={
                  sacoPorKg
                    ? "O item já abre em KG no pedido e na proposta."
                    : rotuloLegado
                      ? "Rótulo do sistema anterior; o preço segue pelo milheiro."
                      : undefined
                }
              >
                <option value="MIL">Milheiro</option>
                <option value="KG">Quilo</option>
                {rotuloLegado && <option value={rotuloLegado}>{rotuloLegado} (sistema anterior)</option>}
              </Selecao>
              <Campo
                name="larguraCm"
                rotulo="Largura"
                sufixo="cm"
                inputMode="decimal"
                required
                placeholder="99"
                value={campos.larguraCm}
                onChange={(e) => alterar("larguraCm")(e.target.value)}
              />
              <Campo
                name="comprimentoCm"
                rotulo="Comprimento"
                sufixo="cm"
                inputMode="decimal"
                required
                placeholder="166"
                value={campos.comprimentoCm}
                onChange={(e) => alterar("comprimentoCm")(e.target.value)}
              />
              <Campo
                name="espessuraMm"
                rotulo="Espessura"
                sufixo="mm"
                inputMode="decimal"
                required
                placeholder="0,08"
                value={campos.espessuraMm}
                onChange={(e) => alterar("espessuraMm")(e.target.value)}
              />
              <Campo
                name="sanfona"
                rotulo="Sanfona"
                dica="Texto livre — o 09 sai com o zero."
                placeholder="13,50"
                value={campos.sanfona}
                onChange={(e) => alterar("sanfona")(e.target.value)}
              />
              <Campo
                name="fatorKg"
                rotulo={sacoPorKg ? "Preço do quilo" : "Fator kg"}
                sufixo={sacoPorKg ? "R$" : undefined}
                inputMode="decimal"
                required
                /*
                  O valor da tabela entra como placeholder, não preenchido: ele
                  lembra quanto está cadastrado sem decidir pelo usuário, que é
                  quem negocia. Continua obrigatório — em branco não salva.
                */
                placeholder={
                  materialDaTabela ? formatarNumero(materialDaTabela.precoKg, 2) : "13,50"
                }
                dica={
                  materialDaTabela
                    ? minimoDoMaterial
                      ? `${materialDaTabela.nome}: tabela ${formatarNumero(
                          materialDaTabela.precoKg,
                          2,
                        )}, mínimo ${formatarNumero(minimoDoMaterial, 2)}.`
                      : `Tabela do ${materialDaTabela.nome}: ${formatarNumero(
                          materialDaTabela.precoKg,
                          2,
                        )}.`
                    : sacoPorKg
                      ? "É o fator kg: o preço do quilo, sem passar pelas medidas."
                      : "R$ por quilo, multiplicado pelo peso do milheiro."
                }
                value={campos.fatorKg}
                onChange={(e) => alterar("fatorKg")(e.target.value)}
              />
              <Campo
                name="densidade"
                rotulo="Densidade"
                inputMode="decimal"
                placeholder="0,1"
                dica="Entra na conta do peso. Vazia, vale 0,1."
                value={campos.densidade}
                onChange={(e) => alterar("densidade")(e.target.value)}
              />
            </div>
          </SecaoCartao>
        )}

        {ehFita && (
          <SecaoCartao
            icone={CircleDot}
            titulo="Fita"
            descricao="Preço de tabela. Escolha primeiro como ela é vendida — a tela pede só o preço que essa conta usa."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Selecao
                  rotulo="Vendida por"
                  value={modoFita.valor}
                  onChange={(e) =>
                    setModoFita(MODOS_FITA.find((m) => m.valor === e.target.value) ?? MODOS_FITA[0])
                  }
                  dica={
                    modoFita.valor === "CAIXA_E_UNIDADE"
                      ? "Cada unidade de venda com o seu preço, sem conta entre eles."
                      : modoFita.valor === "CAIXA_POR_UNIDADE"
                        ? "A caixa sai de unidades por caixa × preço da unidade."
                        : undefined
                  }
                >
                  {MODOS_FITA.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </option>
                  ))}
                </Selecao>
                {usaNaFita("precoCaixa") && (
                  <Campo
                    name="precoCaixa"
                    rotulo="Preço da caixa"
                    sufixo="R$"
                    inputMode="decimal"
                    required
                    value={campos.precoCaixa}
                    onChange={(e) => alterar("precoCaixa")(e.target.value)}
                  />
                )}
                {usaNaFita("precoUnidade") && (
                  <Campo
                    name="precoUnidade"
                    rotulo="Preço por unidade"
                    sufixo="R$"
                    inputMode="decimal"
                    required
                    value={campos.precoUnidade}
                    onChange={(e) => alterar("precoUnidade")(e.target.value)}
                  />
                )}
                {usaNaFita("unidadesPorCaixa") && (
                  <Campo
                    name="unidadesPorCaixa"
                    rotulo="Unidades por caixa"
                    inputMode="numeric"
                    // Na conta pela unidade é ela que faz o preço da caixa; com
                    // preços próprios, é só informação.
                    required={modoFita.valor === "CAIXA_POR_UNIDADE"}
                    value={campos.unidadesPorCaixa}
                    onChange={(e) => alterar("unidadesPorCaixa")(e.target.value)}
                  />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Campo
                  name="larguraMm"
                  rotulo="Largura"
                  sufixo="mm"
                  inputMode="decimal"
                  value={campos.larguraMm}
                  onChange={(e) => alterar("larguraMm")(e.target.value)}
                />
                <Campo
                  name="metragemM"
                  rotulo="Metragem"
                  sufixo="m"
                  inputMode="decimal"
                  value={campos.metragemM}
                  onChange={(e) => alterar("metragemM")(e.target.value)}
                />
              </div>
            </div>
          </SecaoCartao>
        )}

        {ehAvulso && (
          <SecaoCartao
            icone={Package}
            titulo="Avulso"
            descricao="Preço digitado, sem fórmula. Escolha em que unidade o item é vendido — é ela que aparece no pedido."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Selecao
                name="unidadeAvulsa"
                rotulo="Vendido por"
                value={campos.unidadeAvulsa}
                onChange={(e) => alterar("unidadeAvulsa")(e.target.value)}
              >
                {UNIDADES_AVULSO.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.rotulo}
                  </option>
                ))}
              </Selecao>

              <Campo
                name="precoAvulso"
                rotulo="Preço"
                sufixo="R$"
                inputMode="decimal"
                required
                dica="Por unidade de venda escolhida ao lado."
                value={campos.precoAvulso}
                onChange={(e) => alterar("precoAvulso")(e.target.value)}
              />

              <Campo
                name="larguraMm"
                rotulo="Largura"
                sufixo="mm"
                inputMode="decimal"
                dica="Opcional. Entra só na descrição."
                value={campos.larguraMm}
                onChange={(e) => alterar("larguraMm")(e.target.value)}
              />
            </div>
          </SecaoCartao>
        )}

        {!ehSaco && !ehFita && !ehAvulso && (
          <SecaoCartao
            icone={campos.familia === "BOBINA" ? Disc3 : Layers}
            titulo={tipo.rotulo}
            descricao="Vendido por quilo. A quantidade em kg é informada no pedido."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo
                name="precoKg"
                rotulo="Preço por quilo"
                sufixo="R$"
                inputMode="decimal"
                required
                value={campos.precoKg}
                onChange={(e) => alterar("precoKg")(e.target.value)}
              />
              {/*
                Largura × micragem, e a descrição junta os dois — "500X25" no
                stretch. No shrink os pedidos reais trazem as duas escritas,
                "42X0,07" e "420X60", então o campo não fixa unidade: sai
                impresso como foi digitado.
              */}
              <Campo
                name="larguraMm"
                rotulo="Largura"
                sufixo={ehShrink ? undefined : "mm"}
                inputMode="decimal"
                placeholder={ehShrink ? "42" : "500"}
                value={campos.larguraMm}
                onChange={(e) => alterar("larguraMm")(e.target.value)}
              />
              <Campo
                name="micragem"
                rotulo="Micragem"
                inputMode="decimal"
                placeholder={ehShrink ? "0,07" : "25"}
                value={campos.micragem}
                onChange={(e) => alterar("micragem")(e.target.value)}
              />
            </div>
          </SecaoCartao>
        )}

        {campos.fornecedorId && (
          <SecaoCartao
            icone={FlaskConical}
            titulo="Aditivos"
            descricao={
              aditivosDisponiveis.length === 0
                ? "Esta indústria ainda não tem aditivos cadastrados."
                : ehSaco
                  ? "Somam ao fator kg e entram no fim da descrição."
                  : "Entram na descrição. O efeito no preço só existe no saco, que é calculado por fórmula."
            }
          >
            {/* Com poucos aditivos a caixa só ficaria entre a pessoa e a
                etiqueta — o mesmo critério que deixa unidade e frete sem busca. */}
            {aditivosDisponiveis.length > LIMITE_SEM_BUSCA && (
              <label className="block mb-3">
                <span className="sr-only">Buscar aditivo</span>
                <div className="relative">
                  <Search
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
                  />
                  <input
                    type="search"
                    autoComplete="off"
                    value={buscaAditivo}
                    onChange={(e) => setBuscaAditivo(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter aqui é "achei", não "salvar o produto".
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    placeholder="Buscar aditivo pelo nome ou pelo sufixo"
                    className={`${CLASSE_CONTROLE} pl-10`}
                  />
                </div>
              </label>
            )}

            {aditivosDisponiveis.length > 0 && aditivosVisiveis.length === 0 && (
              <p className="text-corpo text-tinta-3">
                Nenhum aditivo com &ldquo;{buscaAditivo.trim()}&rdquo;.
              </p>
            )}

            {aditivosVisiveis.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {aditivosVisiveis.map((aditivo) => {
                  const marcado = campos.aditivos.includes(aditivo.id);

                  return (
                    <label
                      key={aditivo.id}
                      className={`flex items-center gap-2 rounded-suave border px-3 py-2 text-corpo cursor-pointer transition-colors ${
                        marcado
                          ? "border-carimbo bg-carimbo-fraco text-tinta"
                          : "border-filete hover:border-filete-forte text-tinta-2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="aditivos"
                        value={aditivo.id}
                        checked={marcado}
                        onChange={(e) =>
                          setCampos((atual) => ({
                            ...atual,
                            aditivos: e.target.checked
                              ? [...atual.aditivos, aditivo.id]
                              : atual.aditivos.filter((id) => id !== aditivo.id),
                          }))
                        }
                        className="accent-carimbo"
                      />
                      {aditivo.nome}
                      <span className="text-mini text-tinta-3 numerico">
                        +{formatarMoeda(Number(aditivo.valor))}
                        {aditivo.tipo === "POR_KG" ? "/kg" : "/mil"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </SecaoCartao>
        )}

        <SecaoCartao
          icone={FileText}
          titulo="Como sai no pedido"
          descricao="A descrição é montada a partir das medidas, mas você pode ajustar."
        >
          <Campo
            name="descricao"
            rotulo="Descrição impressa"
            required
            value={descricao}
            onChange={(e) => setDescricaoManual(e.target.value)}
            className="font-mono"
          />

          {descricaoDivergente && (
            <BotaoTexto
              type="button"
              onClick={() => setDescricaoManual(null)}
              className="mt-2"
            >
              Voltar para a gerada: <span className="font-mono">{descricaoGerada}</span>
            </BotaoTexto>
          )}

          {/*
            Saco por quilo: o preço é o fator (com os aditivos por kg), a mesma
            conta de `precoUnitario` no pedido. Os aditivos por milheiro não
            têm milheiro onde entrar e ficam de fora — dito aqui, e não
            descoberto no pedido.
          */}
          {sacoPorKg && precoDoKg && (
            <Cartao className="mt-4 p-4 bg-folha-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div className="text-corpo text-tinta-2">Preço do quilo</div>
                <div className="text-forte font-semibold cifra numerico">
                  {formatarMoeda(precoDoKg.toNumber())}
                </div>
              </div>

              {aditivosEscolhidos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-filete text-mini text-tinta-3 font-mono numerico leading-relaxed">
                  preço {formatarNumero(lerNumeroBr(campos.fatorKg) ?? 0, 2)} + aditivos por kg ={" "}
                  {formatarNumero(precoDoKg.toNumber(), 2)}
                  {aditivosEscolhidos.some((a) => a.tipo !== "POR_KG") && (
                    <div className="mt-1 font-sans">
                      Aditivo cobrado por milheiro não entra no preço do quilo.
                    </div>
                  )}
                </div>
              )}

              {faltaNoKg !== null && materialDaTabela && (
                <p className="mt-3 pt-3 border-t border-filete text-mini text-perigo leading-relaxed">
                  Abaixo do mínimo do {materialDaTabela.nome} (
                  {formatarNumero(minimoDoMaterial ?? 0, 2)}):{" "}
                  <span className="numerico">{formatarMoeda(faltaNoKg)}</span> a menos por quilo.
                </p>
              )}
            </Cartao>
          )}

          {calculo && !sacoPorKg && (
            <Cartao className="mt-4 p-4 bg-folha-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div className="text-corpo text-tinta-2">Preço do milheiro</div>
                <div className="text-forte font-semibold cifra numerico">
                  {formatarMoeda(calculo.precoMilheiro.toNumber())}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-filete text-mini text-tinta-3 font-mono numerico leading-relaxed">
                {formatarNumero(calculo.largura)} × {formatarNumero(calculo.comprimento)} ×{" "}
                {formatarNumero(calculo.espessura, 2)} × {formatarNumero(calculo.densidade)} ={" "}
                {formatarNumero(calculo.pesoMilheiro.toNumber(), 2)} kg
                <div className="mt-1">
                  × fator {formatarNumero(calculo.fatorEfetivo.toNumber(), 2)} ={" "}
                  {formatarNumero(calculo.precoMilheiro.toNumber(), 2)}
                </div>
                {aditivosEscolhidos.length > 0 && (
                  <div className="mt-1">
                    fator {formatarNumero(calculo.fator, 2)} + aditivos ={" "}
                    {formatarNumero(calculo.fatorEfetivo.toNumber(), 2)}
                  </div>
                )}
              </div>

              {/*
                Aviso, não impedimento: vender abaixo do piso é decisão de quem
                negocia. O que o sistema faz é mostrar o tamanho da conta — e o
                que encolhe não é só o faturamento, é a comissão em cima dele.

                Fica aqui no painel, e não no campo, justamente para não parecer
                o erro vermelho que barra o salvar.
              */}
              {calculo.falta && materialDaTabela && (
                <p className="mt-3 pt-3 border-t border-filete text-mini text-perigo leading-relaxed">
                  Abaixo do mínimo do {materialDaTabela.nome} (
                  {formatarNumero(minimoDoMaterial ?? 0, 2)}):{" "}
                  <span className="numerico">
                    {formatarMoeda(calculo.falta.toNumber())}
                  </span>{" "}
                  a menos por milheiro
                  {comissaoDaIndustria !== null && (
                    <>
                      , ≈{" "}
                      <span className="numerico">
                        {formatarMoeda(
                          calculo.falta.times(comissaoDaIndustria).dividedBy(100).toNumber(),
                        )}
                      </span>{" "}
                      de comissão a {formatarNumero(comissaoDaIndustria, 2)}%
                    </>
                  )}
                  .
                </p>
              )}
            </Cartao>
          )}
        </SecaoCartao>
      </fieldset>

      {editavel && (
        <div className="flex justify-end">
          <Botao type="submit" carregando={enviando}>
            {enviando ? "Salvando…" : rotuloEnvio}
          </Botao>
        </div>
      )}
    </form>
  );
}
