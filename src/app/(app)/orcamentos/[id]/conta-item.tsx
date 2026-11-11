"use client";

/**
 * O item da proposta avulsa, feito de conta.
 *
 * Para quem ainda não é cliente não há produto dele a escolher — e oferecer o
 * de outro traria o preço negociado com outra empresa. Então a linha nasce
 * aqui: a família, os campos dela e o preço saindo da mesma conta do cadastro
 * de produto (`precoUnitario`, `descricaoSaco`…). Nada é cadastrado agora; a
 * conta fica guardada no item para, se o negócio andar, virar produto do
 * cliente sem redigitar.
 */

import { useActionState, useMemo, useState } from "react";

import { CampoAcabamento, EscolhaMaoDeObra } from "@/components/campo-acabamento";
import { CampoAditivos } from "@/components/campo-aditivos";
import { CampoComplemento } from "@/components/campo-complemento";
import {
  CampoFornecedorDaTampa,
  CamposDaTampa,
  MedidasEmbalagem,
  PrecoDaEmbalagem,
} from "@/components/campos-embalagem";
import { type OpcaoBuscavel, SelecaoBuscavel } from "@/components/selecao-buscavel";
import { ErroGeral, Formulario } from "@/components/formulario";
import {
  Botao,
  BotaoTexto,
  Campo,
  EspacoDoRotulo,
  Selecao,
  formatarMoeda,
} from "@/components/ui";
import { CAMPO_IPI, CAMPO_IPI_DEFINIDO } from "@/lib/ipi-do-formulario";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { escreverNumeroBr, lerNumeroBr } from "@/lib/numero-br";
import { DENSIDADE_PADRAO, pesoMilheiroKg } from "@/lib/precificacao";
import {
  ROTULO_UNIDADE,
  type Familia,
  type MarcaMaoDeObra,
  type ProdutoPrecificavel,
  type UnidadeVenda,
  ehPorMilheiro,
  opcoesDeMaoDeObra,
  precoUnitario,
  unidadesDaFamilia,
} from "@/lib/produto-preco";
import {
  OPCOES_TIPO,
  type CamposDaEmbalagem,
  type TipoProduto,
  camposAoTrocarDeTipo,
  descricaoDoTipo,
  tipoPorValor,
  unidadeDeVenda,
} from "@/lib/tipos-produto";

import type { EstadoFormulario } from "../acoes";
import type { Conta } from "../../produtos/leitura";
import type { AditivoOpcao, MaterialOpcao } from "../../produtos/formulario";

/**
 * Como a fita é vendida — escolhido ANTES dos preços, para a tela pedir só o
 * que a conta usa.
 *
 * Caixa com preço de caixa e unidade com preço de unidade são contas de um
 * número só; a caixa pelo preço da unidade é a conta do SICOV (unidades por
 * caixa × preço de cada), e só ela precisa dos dois.
 */
const MODOS_FITA = [
  { valor: "CAIXA", rotulo: "Caixa", unidade: "CX", campos: ["precoCaixa"] },
  {
    valor: "CAIXA_POR_UNIDADE",
    rotulo: "Caixa, pelo preço da unidade",
    unidade: "CX",
    campos: ["precoUnidade", "unidadesPorCaixa"],
  },
  { valor: "UNIDADE", rotulo: "Unidade", unidade: "UN", campos: ["precoUnidade"] },
] as const satisfies readonly {
  valor: string;
  rotulo: string;
  unidade: UnidadeVenda;
  campos: readonly ("precoCaixa" | "precoUnidade" | "unidadesPorCaixa")[];
}[];

type ModoFita = (typeof MODOS_FITA)[number];

/** A conta começa sem tipo, como o cadastro de produto: nem sempre é saco. */
const CONTA_VAZIA: Conta = {
  familia: "",
  material: "",
  complemento: "",
  unidadeRotulo: "",
  larguraCm: "",
  comprimentoCm: "",
  espessuraMm: "",
  densidade: "",
  sanfona: "",
  fatorKg: "",
  larguraMm: "",
  metragemM: "",
  micragem: "",
  unidadesPorCaixa: "",
  precoUnidade: "",
  precoCaixa: "",
  precoKg: "",
  unidadeAvulsa: "UN",
  precoAvulso: "",
  capacidade: "",
  capacidadeUnidade: "",
  alturaCm: "",
  diametroMm: "",
  larguraM: "",
  comprimentoMm: "",
  materialTampa: "",
  complementoTampa: "",
  fornecedorTampaId: "",
  fornecedorTampaVariavel: "",
  acabamento: "",
  acabamentoValorCom: "",
  acabamentoValorSem: "",
  aditivos: [],
};

/** Número digitado para o motor de preço: texto normalizado, ou nulo se vazio. */
const numero = (texto: string) => {
  const lido = lerNumeroBr(texto);
  return lido === null ? null : String(lido);
};

export function ContaItem({
  materiais,
  aditivos,
  industrias,
  adicionar,
}: {
  materiais: MaterialOpcao[];
  aditivos: AditivoOpcao[];
  /** Quem pode fornecer a tampa dos conjuntos. */
  industrias: OpcaoBuscavel[];
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [conta, setConta] = useState<Conta>(CONTA_VAZIA);
  /** Sem tipo, a tela mostra só a escolha dele: o resto da conta depende do tipo. */
  const [tipo, setTipo] = useState<TipoProduto | null>(null);
  const [modoFita, setModoFita] = useState<ModoFita>(MODOS_FITA[0]);
  const [descricaoManual, setDescricaoManual] = useState<string | null>(null);
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<UnidadeVenda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [precoManual, setPrecoManual] = useState<string | null>(null);
  /** Com ou sem mão de obra: a conta é o item, e por isso a escolha mora aqui. */
  const [maoDeObra, setMaoDeObra] = useState<MarcaMaoDeObra | "">("");

  /*
   * Lançou, zera: cada linha é uma conta nova, e campo que sobra da anterior
   * vira medida errada no item seguinte sem ninguém notar.
   *
   * Só no SUCESSO. Recusada, a conta fica na tela para corrigir o que o erro
   * aponta — apagá-la obrigaria a redigitar tudo por causa de um campo.
   */
  const [estado, enviar, enviando] = useActionState(
    async (anterior: EstadoFormulario, formData: FormData) => {
      const resultado = await adicionar(anterior, formData);
      if (!resultado.erro) {
        setConta(CONTA_VAZIA);
        setTipo(null);
        setModoFita(MODOS_FITA[0]);
        setDescricaoManual(null);
        setUnidadeEscolhida("");
        setQuantidade("");
        setPrecoManual(null);
        setMaoDeObra("");
      }
      return resultado;
    },
    {},
  );

  const alterar = (campo: keyof Omit<Conta, "aditivos">) => (valor: string) => {
    setConta((atual) => ({ ...atual, [campo]: valor }));
    // Mexer na conta muda o preço calculado; um preço digitado antes dela
    // ficaria valendo por cima sem ninguém perceber.
    setPrecoManual(null);
  };

  const familia = conta.familia as Familia;
  const ehSaco = familia === "SACO";
  const ehFita = familia === "FITA";
  const ehAvulso = familia === "AVULSO";
  const ehShrink = tipo?.valor === "SHRINK";
  const ehEmbalagem = ehPorMilheiro(familia);

  /** As sugestões do campo Material fora do saco, conforme o tipo. */
  const sugestoesMaterial = useMemo(
    () => (tipo?.materiais ?? []).map((m) => ({ id: m, rotulo: m })),
    [tipo],
  );

  const alterarEmbalagem = (campo: keyof CamposDaEmbalagem, valor: string) => {
    alterar(campo)(valor);
    if (campo === "acabamento") setMaoDeObra("");
  };

  /** Troca o tipo. Mudou de família, a conta recomeça: ver `camposAoTrocarDeTipo`. */
  function escolherTipo(valor: string) {
    const novo = tipoPorValor(valor);

    setConta((atual) => camposAoTrocarDeTipo(tipo, novo, atual, CONTA_VAZIA));

    if (novo.familia !== tipo?.familia) {
      setModoFita(MODOS_FITA[0]);
      setDescricaoManual(null);
      setUnidadeEscolhida("");
      setQuantidade("");
      setMaoDeObra("");
    }
    setTipo(novo);
    setPrecoManual(null);
  }

  /*
   * As opções do Material do saco — as mesmas do cadastro de produto: a tabela
   * da indústria, uma vez cada nome, com o preço do kg ao lado; e o material
   * que já está na conta mas não na tabela, marcado, para não sumir da caixa.
   */
  const opcoesMaterial = useMemo(() => {
    const opcoes = materiais
      .filter((m, i, todos) => todos.findIndex((o) => o.nome === m.nome) === i)
      .map((m) => ({
        id: m.nome,
        rotulo: m.nome,
        detalhe: `${formatarMoeda(Number(m.precoKg))} / kg`,
      }));

    const atual = conta.material.trim();
    return atual && !opcoes.some((o) => o.id.toLowerCase() === atual.toLowerCase())
      ? [{ id: conta.material, rotulo: conta.material, detalhe: "fora da tabela" }, ...opcoes]
      : opcoes;
  }, [materiais, conta.material]);

  const materialDaTabela = materiais.find(
    (m) => m.nome.toLowerCase() === conta.material.trim().toLowerCase(),
  );

  const aditivosEscolhidos = useMemo(
    () => aditivos.filter((a) => conta.aditivos.includes(a.id)),
    [aditivos, conta.aditivos],
  );

  /*
   * Na fita, só conta o que o modo mostra. O que foi digitado em outro modo
   * fica guardado (voltar a ele traz de volta), mas não entra no preço — nem
   * vai ao servidor, porque o campo escondido não está no formulário.
   */
  const usaNaFita = (campo: ModoFita["campos"][number]) =>
    familia !== "FITA" || (modoFita.campos as readonly string[]).includes(campo);

  const opcoesMaoDeObra = opcoesDeMaoDeObra({
    acabamento: conta.acabamento,
    acabamentoValorCom: numero(conta.acabamentoValorCom),
    acabamentoValorSem: numero(conta.acabamentoValorSem),
  });
  const marcaCobrada =
    opcoesMaoDeObra.length === 1
      ? opcoesMaoDeObra[0].marca
      : opcoesMaoDeObra.find((o) => o.marca === maoDeObra)?.marca;

  /** A conta no formato do motor de preço — o mesmo que o produto usaria. */
  const precificavel: ProdutoPrecificavel = {
    familia,
    larguraCm: numero(conta.larguraCm),
    comprimentoCm: numero(conta.comprimentoCm),
    espessuraMm: numero(conta.espessuraMm),
    fatorKg: numero(conta.fatorKg),
    densidade: numero(conta.densidade),
    precoUnidade: usaNaFita("precoUnidade") ? numero(conta.precoUnidade) : null,
    precoCaixa: usaNaFita("precoCaixa") ? numero(conta.precoCaixa) : null,
    unidadesPorCaixa: usaNaFita("unidadesPorCaixa") ? lerNumeroBr(conta.unidadesPorCaixa) : null,
    precoKg: numero(conta.precoKg),
    unidadeAvulsa: (conta.unidadeAvulsa || null) as UnidadeVenda | null,
    precoAvulso: numero(conta.precoAvulso),
    acabamento: conta.acabamento,
    acabamentoMaoDeObra: marcaCobrada ? marcaCobrada === "COM" : null,
    acabamentoValorCom: numero(conta.acabamentoValorCom),
    acabamentoValorSem: numero(conta.acabamentoValorSem),
    aditivos: aditivosEscolhidos,
  };

  /*
   * A unidade: a do avulso é a do preço digitado; a da fita, a do modo
   * escolhido lá em cima; nas outras, as da família. Escolha que deixou de
   * valer (trocou de família) cai na primeira.
   */
  const vendidoPor = tipo ? unidadeDeVenda(tipo, conta.unidadeAvulsa) : "MIL";
  const unidades: UnidadeVenda[] = !tipo
    ? []
    : ehAvulso
      ? [conta.unidadeAvulsa as UnidadeVenda]
      : ehFita
        ? [modoFita.unidade]
        : // O tipo que escolhe a unidade do preço fica nela, como o avulso; no
          // milheiro, a unidade vem junto.
          ehEmbalagem && vendidoPor !== "MIL"
          ? [vendidoPor]
          : ehEmbalagem
            ? ["MIL", "UN"]
            : unidadesDaFamilia(familia);
  const unidade =
    unidadeEscolhida && unidades.includes(unidadeEscolhida) ? unidadeEscolhida : unidades[0];

  const precoCalculado = tipo ? precoUnitario(precificavel, unidade) : null;

  // Precisão cheia no campo, como no catálogo: cortar em centavos faria o
  // total errar o centavo que a indústria não erra.
  const preco =
    precoManual ?? (precoCalculado ? escreverNumeroBr(precoCalculado.toFixed(6), 2, 6) : "");

  const sufixos = aditivosEscolhidos.map((a) => a.sufixoDescricao);

  const descricaoGerada = (() => {
    if (!tipo) return "";
    if (ehEmbalagem) return descricaoDoTipo(tipo, conta, sufixos);

    if (ehSaco) {
      const { larguraCm, comprimentoCm, espessuraMm } = precificavel;
      if (larguraCm == null || comprimentoCm == null || espessuraMm == null) return "";

      return descricaoSaco({
        larguraCm,
        comprimentoCm,
        espessuraMm,
        sanfona: conta.sanfona,
        material: conta.material,
        complemento: conta.complemento,
        adicionais: sufixos,
      });
    }

    if (ehFita) {
      return descricaoFita({
        material: conta.material,
        larguraMm: numero(conta.larguraMm),
        metragemM: numero(conta.metragemM),
        complemento: conta.complemento,
        adicionais: sufixos,
      });
    }

    return descricaoRolo({
      material: conta.material,
      larguraMm: numero(conta.larguraMm),
      micragem: ehAvulso ? null : numero(conta.micragem),
      complemento: conta.complemento,
      adicionais: sufixos,
    });
  })();

  // Mexeu na conta, a descrição volta a ser a gerada — como no cadastro de
  // produto: o saco que virou 35x45 não pode seguir escrito 30x40.
  const [geradaVista, setGeradaVista] = useState(descricaoGerada);
  if (descricaoGerada !== geradaVista) {
    setGeradaVista(descricaoGerada);
    setDescricaoManual(null);
  }

  const descricao = descricaoManual ?? descricaoGerada;

  /** O rastro da conta do saco, para conferir de olho antes de lançar. */
  const pesoMilheiro =
    ehSaco &&
    unidade === "MIL" &&
    precificavel.larguraCm != null &&
    precificavel.comprimentoCm != null &&
    precificavel.espessuraMm != null
      ? pesoMilheiroKg(
          {
            larguraCm: precificavel.larguraCm,
            comprimentoCm: precificavel.comprimentoCm,
            espessuraMm: precificavel.espessuraMm,
          },
          precificavel.densidade,
        )
      : null;

  const totalPrevisto = (() => {
    const qtd = lerNumeroBr(quantidade);
    const unit = lerNumeroBr(preco);
    return qtd === null || unit === null ? null : qtd * unit;
  })();

  /** Material da tabela traz a densidade; o fator fica só sugerido, como no produto. */
  function escolherMaterial(texto: string) {
    const nome = ehSaco ? texto.toUpperCase() : texto;
    const escolhido = materiais.find((m) => m.nome.toLowerCase() === nome.trim().toLowerCase());

    setConta((atual) => ({
      ...atual,
      material: nome,
      densidade:
        ehSaco && escolhido?.densidade ? formatarNumero(escolhido.densidade) : atual.densidade,
    }));
    setPrecoManual(null);
  }

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">

      <p className="text-corpo text-tinta-2 leading-relaxed">
        Sem produto pronto: quem ainda não é cliente não tem produto cadastrado. Faça a conta do
        item — ele entra na soma e só vira produto depois de o cliente ser cadastrado.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
        <SelecaoBuscavel
          name="tipo"
          rotulo="Tipo"
          required
          opcoes={OPCOES_TIPO}
          value={tipo?.valor ?? ""}
          aoEscolher={escolherTipo}
          placeholder="Digite para achar…"
          dica={
            !tipo
              ? "Escolha primeiro: a conta do item depende do tipo."
              : ehShrink
                ? "Vendido por kg; entra no cadastro como stretch."
                : ehEmbalagem
                  ? tipo.unidadesVenda
                    ? "Preço digitado, na unidade que se escolher."
                    : "Vendido por milheiro, com preço digitado."
                  : undefined
          }
        />
        <input type="hidden" name="familia" value={conta.familia} />

        {/* `contents`: os dois seguem na grade, e entram em cascata ao aparecer. */}
        {tipo && (
          <div className="contents palco">
            {/*
              No saco, material é a tabela de preço da indústria: escolhe-se dela,
              digitando. Nos outros tipos a lista só sugere, e o que se digita vale.
            */}
            {ehSaco ? (
              <SelecaoBuscavel
                name="material"
                rotulo="Material"
                opcoes={opcoesMaterial}
                value={conta.material}
                aoEscolher={escolherMaterial}
                placeholder="Digite para achar…"
                vazio="Nenhum material da tabela desta indústria com esse nome."
                dica={
                  materialDaTabela
                    ? `Tabela desta indústria: ${formatarMoeda(materialDaTabela.precoKg)} / kg.`
                    : conta.material
                      ? "Fora da tabela desta indústria."
                      : undefined
                }
              />
            ) : (
              <SelecaoBuscavel
                livre
                name="material"
                rotulo={tipo.rotuloMaterial ?? "Nome na descrição"}
                opcoes={sugestoesMaterial}
                value={conta.material}
                aoEscolher={escolherMaterial}
                placeholder={tipo.materialAbre ? tipo.nome || "Nome do item" : undefined}
              />
            )}

            {/* Com etiquetas, ocupa a linha inteira: elas não cabem numa coluna. */}
            <CampoComplemento
              key={tipo.valor}
              rotulo={tipo.rotuloComplemento}
              grupos={tipo.complementos}
              value={conta.complemento}
              aoMudar={alterar("complemento")}
              placeholder={
                ehSaco
                  ? "AZUL"
                  : ehFita
                    ? "transparente"
                    : ehAvulso || ehEmbalagem
                      ? ""
                      : ehShrink
                        ? "BOBINA COM 20 KG"
                        : "BOBINA 4KG PESO LÍQUIDO"
              }
              className={tipo.complementos.length > 0 ? "sm:col-span-2 lg:col-span-3" : ""}
            />
          </div>
        )}
      </div>

      {/*
        O resto da conta entra em cascata ao escolher o tipo, e cada bloco que
        aparece depois também. Só aqui dentro: a proposta já tem o `palco` dela,
        e este cartão inteiro animaria duas vezes ao abrir a página.
      */}
      {tipo && (
        <div className="space-y-4 palco">
          {ehEmbalagem && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 lg:items-start">
              <MedidasEmbalagem tipo={tipo} valores={conta} aoMudar={alterarEmbalagem} />
              <PrecoDaEmbalagem tipo={tipo} valores={conta} aoMudar={alterarEmbalagem} />
            </div>
          )}

          {tipo.comTampa && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 lg:items-start">
              <CamposDaTampa valores={conta} aoMudar={alterarEmbalagem} />
              <CampoFornecedorDaTampa
                naConta
                industrias={industrias}
                valores={conta}
                aoMudar={alterarEmbalagem}
              />
            </div>
          )}

          {tipo.acabamentos && (
            <div>
              <CampoAcabamento
                grupos={tipo.acabamentos}
                valores={conta}
                aoMudar={alterarEmbalagem}
              />
              {opcoesMaoDeObra.length > 0 && (
                <div className="mt-3">
                  <EscolhaMaoDeObra
                    acabamento={conta.acabamento}
                    opcoes={opcoesMaoDeObra}
                    value={marcaCobrada ?? ""}
                    aoMudar={(marca) => {
                      setMaoDeObra(marca);
                      setPrecoManual(null);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {ehSaco && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:items-start">
              <CampoNumero rotulo="Largura" sufixo="cm" nome="larguraCm" conta={conta} alterar={alterar} obrigatorio />
              <CampoNumero rotulo="Comprimento" sufixo="cm" nome="comprimentoCm" conta={conta} alterar={alterar} obrigatorio />
              <CampoNumero rotulo="Espessura" sufixo="mm" nome="espessuraMm" conta={conta} alterar={alterar} obrigatorio placeholder="0,08" />
              <Campo
                name="sanfona"
                rotulo="Sanfona"
                numero="decimal"
                placeholder="13,50"
                value={conta.sanfona}
                onChange={(e) => alterar("sanfona")(e.target.value)}
              />
              <CampoNumero
                rotulo="Fator kg"
                nome="fatorKg"
                conta={conta}
                alterar={alterar}
                obrigatorio
                placeholder={
                  materialDaTabela ? formatarNumero(materialDaTabela.precoKg, 2) : "13,50"
                }
              />
              <CampoNumero rotulo="Densidade" nome="densidade" conta={conta} alterar={alterar} placeholder="0,1" />
            </div>
          )}

          {ehFita && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 lg:items-start">
              <Selecao
                name="modoFita"
                rotulo="Vendida por"
                value={modoFita.valor}
                onChange={(e) => {
                  setModoFita(MODOS_FITA.find((m) => m.valor === e.target.value) ?? MODOS_FITA[0]);
                  setPrecoManual(null);
                }}
              >
                {MODOS_FITA.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </Selecao>
              {usaNaFita("precoCaixa") && (
                <CampoNumero rotulo="Preço da caixa" sufixo="R$" nome="precoCaixa" conta={conta} alterar={alterar} obrigatorio />
              )}
              {usaNaFita("precoUnidade") && (
                <CampoNumero rotulo="Preço por unidade" sufixo="R$" nome="precoUnidade" conta={conta} alterar={alterar} obrigatorio />
              )}
              {usaNaFita("unidadesPorCaixa") && (
                <CampoNumero rotulo="Unidades por caixa" nome="unidadesPorCaixa" conta={conta} alterar={alterar} obrigatorio />
              )}
              <CampoNumero rotulo="Largura" sufixo="mm" nome="larguraMm" conta={conta} alterar={alterar} />
              <CampoNumero rotulo="Metragem" sufixo="m" nome="metragemM" conta={conta} alterar={alterar} />
            </div>
          )}

          {/*
            Stretch e bobina se medem em largura (mm) × micragem — "500X25". O
            shrink, em largura × espessura (mm) — "42X0,07". É o mesmo par de
            campos, só com o nome que cada um usa; a descrição junta os dois do
            mesmo jeito.
          */}
          {(familia === "STRETCH" || familia === "BOBINA") && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:items-start">
              <CampoNumero rotulo="Preço por quilo" sufixo="R$" nome="precoKg" conta={conta} alterar={alterar} obrigatorio />
              <CampoNumero
                rotulo="Largura"
                sufixo={ehShrink ? undefined : "mm"}
                nome="larguraMm"
                conta={conta}
                alterar={alterar}
                placeholder={ehShrink ? "42" : "500"}
              />
              <CampoNumero
                rotulo={ehShrink ? "Espessura" : "Micragem"}
                sufixo={ehShrink ? "mm" : undefined}
                nome="micragem"
                conta={conta}
                alterar={alterar}
                placeholder={ehShrink ? "0,07" : "25"}
              />
            </div>
          )}

          {ehAvulso && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:items-start">
              <Selecao
                name="unidadeAvulsa"
                rotulo="Vendido por"
                value={conta.unidadeAvulsa}
                onChange={(e) => alterar("unidadeAvulsa")(e.target.value)}
              >
                <option value="UN">Unidade</option>
                <option value="KG">Quilo</option>
                <option value="CX">Caixa</option>
                <option value="MIL">Milheiro</option>
              </Selecao>
              <CampoNumero rotulo="Preço" sufixo="R$" nome="precoAvulso" conta={conta} alterar={alterar} obrigatorio />
              <CampoNumero rotulo="Largura" sufixo="mm" nome="larguraMm" conta={conta} alterar={alterar} />
            </div>
          )}

          {aditivos.length > 0 && (
            <CampoAditivos
              aditivos={aditivos}
              marcados={conta.aditivos}
              aoAlternar={(id) => {
                setConta((atual) => ({
                  ...atual,
                  aditivos: atual.aditivos.includes(id)
                    ? atual.aditivos.filter((a) => a !== id)
                    : [...atual.aditivos, id],
                }));
                setPrecoManual(null);
              }}
            />
          )}

          <div>
            <Campo
              name="descricao"
              rotulo="Descrição impressa"
              required
              value={descricao}
              onChange={(e) => setDescricaoManual(e.target.value)}
              className="font-mono"
            />
            {descricaoManual !== null && descricaoGerada !== "" && descricaoManual !== descricaoGerada && (
              <BotaoTexto type="button" onClick={() => setDescricaoManual(null)} className="mt-2">
                Voltar para a gerada: <span className="font-mono">{descricaoGerada}</span>
              </BotaoTexto>
            )}
          </div>

          {pesoMilheiro && precoCalculado && (
            <p className="text-mini text-tinta-3 font-mono numerico leading-relaxed">
              {formatarNumero(precificavel.larguraCm!)} × {formatarNumero(precificavel.comprimentoCm!)} ×{" "}
              {formatarNumero(precificavel.espessuraMm!, 2)} ×{" "}
              {formatarNumero(precificavel.densidade ?? DENSIDADE_PADRAO)} ={" "}
              {formatarNumero(pesoMilheiro.toDecimalPlaces(3), 2)} kg · milheiro{" "}
              {formatarMoeda(precoCalculado.toNumber())}
            </p>
          )}

          {/* Por quilo o saco não passa pelas medidas: o preço do kg é o fator. */}
          {ehSaco && unidade === "KG" && precoCalculado && (
            <p className="text-mini text-tinta-3 font-mono numerico leading-relaxed">
              fator {formatarNumero(precificavel.fatorKg!, 2)}
              {aditivosEscolhidos.some((a) => a.tipo === "POR_KG") && " + aditivos por kg"} ={" "}
              {formatarMoeda(precoCalculado.toNumber())} / kg · a quantidade é em quilos
            </p>
          )}

          {/* Mesma régua do lançamento de catálogo: rótulo em cima, caixas alinhadas pelo topo. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[7rem_8rem_9.5rem_auto_auto] lg:items-start pt-3 border-t border-filete">
            <Selecao
              name="unidade"
              rotulo="Unidade"
              required
              value={unidade}
              onChange={(e) => {
                setUnidadeEscolhida(e.target.value as UnidadeVenda);
                setPrecoManual(null);
              }}
            >
              {unidades.map((u) => (
                <option key={u} value={u}>
                  {ROTULO_UNIDADE[u]}
                </option>
              ))}
            </Selecao>

            <Campo
              name="quantidade"
              rotulo="Quantidade"
              numero="decimal"
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />

            <Campo
              name="precoUnitario"
              rotulo="Preço"
              numero="decimal"
              value={preco}
              onChange={(e) => setPrecoManual(e.target.value)}
              dica={precoCalculado ? "Calculado — dá para ajustar." : undefined}
            />

            <label className="block">
              <span className="rotulo block mb-1.5">IPI</span>
              <span className="flex items-center gap-2 px-3.5 py-2.5 rounded-suave bg-folha-2 border border-transparent">
                <input type="hidden" name={CAMPO_IPI_DEFINIDO} value="1" />
                <input type="checkbox" name={CAMPO_IPI} defaultChecked className="accent-carimbo" />
                <span className="text-corpo text-tinta-2 whitespace-nowrap">Cobrar</span>
              </span>
            </label>

            <div className="block">
              <EspacoDoRotulo />
              <Botao
                type="submit"
                variante="secundaria"
                className="w-full lg:w-auto"
                disabled={enviando || !descricao || !preco}
              >
                {enviando ? "Adicionando…" : "Adicionar"}
              </Botao>
            </div>
          </div>

          {totalPrevisto !== null && (
            <p className="text-mini text-tinta-3 numerico">
              Este item entra por {formatarMoeda(totalPrevisto)} antes do IPI.
            </p>
          )}
        </div>
      )}

      <ErroGeral />
    </Formulario>
  );
}

function CampoNumero({
  rotulo,
  nome,
  sufixo,
  placeholder,
  obrigatorio,
  conta,
  alterar,
}: {
  rotulo: string;
  nome: keyof Omit<Conta, "aditivos">;
  sufixo?: string;
  placeholder?: string;
  obrigatorio?: boolean;
  conta: Conta;
  alterar: (campo: keyof Omit<Conta, "aditivos">) => (valor: string) => void;
}) {
  return (
    <Campo
      name={nome}
      rotulo={rotulo}
      sufixo={sufixo}
      numero="decimal"
      required={obrigatorio}
      placeholder={placeholder}
      value={conta[nome]}
      onChange={(e) => alterar(nome)(e.target.value)}
    />
  );
}
