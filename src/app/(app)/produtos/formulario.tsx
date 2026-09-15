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
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  Botao,
  BotaoTexto,
  Campo,
  Cartao,
  MensagemErro,
  SecaoCartao,
  Selecao,
  formatarMoeda,
} from "@/components/ui";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { lerNumeroBr } from "@/lib/numero-br";
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
const LISTA_MATERIAIS = "materiais-da-industria";

const FAMILIAS = [
  { valor: "SACO", rotulo: "Saco plástico" },
  { valor: "FITA", rotulo: "Fita" },
  { valor: "STRETCH", rotulo: "Stretch" },
  { valor: "BOBINA", rotulo: "Bobina" },
  { valor: "AVULSO", rotulo: "Avulso" },
] as const;

/** O avulso é vendido na unidade que se escolher; as outras famílias têm a sua. */
const UNIDADES_AVULSO = [
  { valor: "UN", rotulo: "Unidade" },
  { valor: "KG", rotulo: "Quilo" },
  { valor: "CX", rotulo: "Caixa" },
  { valor: "MIL", rotulo: "Milheiro" },
] as const;

export type ClienteOpcao = { id: string; apelido: string };

export function FormularioProduto({
  fornecedores,
  clientes,
  valores,
  acao,
  rotuloEnvio,
}: {
  fornecedores: FornecedorOpcao[];
  clientes: ClienteOpcao[];
  valores: ValoresProduto;
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  rotuloEnvio: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  const [campos, setCampos] = useState<ValoresProduto>(valores);
  /** Descrição digitada à mão. `null` = seguir a gerada automaticamente. */
  const [descricaoManual, setDescricaoManual] = useState<string | null>(
    // Ao editar um produto já salvo, respeita o que está gravado.
    valores.descricao ? valores.descricao : null,
  );

  const alterar = (campo: keyof ValoresProduto) => (valor: string) =>
    setCampos((atual) => ({ ...atual, [campo]: valor }));

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

      <SecaoCartao icone={Factory} titulo="Origem">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            name="fornecedorId"
            rotulo="Indústria"
            required
            value={campos.fornecedorId}
            onChange={(e) => {
              const novo = e.target.value;
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
          >
            <option value="">Escolha…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>

          {/*
            De quem é o produto.

            O mesmo saco cotado para dois clientes são dois produtos, com preço
            próprio — e é o cliente que distingue as linhas de descrição
            idêntica no catálogo. Fica vazio só para item de prateleira.
          */}
          <Selecao
            name="clienteId"
            rotulo="Cliente"
            value={campos.clienteId}
            onChange={(e) => alterar("clienteId")(e.target.value)}
            dica="Deixe vazio se for item de catálogo, sem dono."
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apelido}
              </option>
            ))}
          </Selecao>

          <Selecao
            name="familia"
            rotulo="Família"
            value={campos.familia}
            onChange={(e) => alterar("familia")(e.target.value)}
            dica={
              ehSaco
                ? "Só o saco tem preço calculado por fórmula."
                : ehAvulso
                  ? "Para o que não é saco, fita, stretch nem bobina."
                  : "Preço de tabela."
            }
          >
            {FAMILIAS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </Selecao>

          <Campo
            name="codigoFornecedor"
            rotulo="Código na indústria"
            dica="Sai na coluna COD.FORN do pedido."
            value={campos.codigoFornecedor}
            onChange={(e) => alterar("codigoFornecedor")(e.target.value)}
          />

          <div>
            <Campo
              name="material"
              rotulo={ehSaco ? "Material" : "Tipo do produto"}
              // A lista só aparece no saco: é lá que material é uma tabela de
              // preço. Nas outras famílias o campo abre a descrição com texto
              // livre ("Fita adesiva"), e sugerir PEAD ali só atrapalharia.
              list={ehSaco && materiaisDisponiveis.length > 0 ? LISTA_MATERIAIS : undefined}
              dica={
                ehSaco
                  ? materialDaTabela
                    ? `Tabela desta indústria: ${formatarMoeda(materialDaTabela.precoKg)} / kg.`
                    : "Sai depois das medidas, como PEAD no pedido 2253."
                  : "Abre a descrição, como “Fita adesiva” ou “FILM STRETCH”."
              }
              placeholder={ehSaco ? "PEAD" : "FILM STRETCH"}
              value={campos.material}
              onChange={(e) => escolherMaterial(e.target.value)}
            />
            {ehSaco && materiaisDisponiveis.length > 0 && (
              <datalist id={LISTA_MATERIAIS}>
                {materiaisDisponiveis.map((m) => (
                  <option key={m.nome} value={m.nome} />
                ))}
              </datalist>
            )}
          </div>

          <Campo
            name="complemento"
            rotulo="Complemento"
            dica="Fecha a descrição: cor, acabamento, peso da bobina."
            placeholder={ehSaco ? "" : "BOBINA 4KG PESO LÍQUIDO"}
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
          descricao="São elas que formam o preço. A sanfona entra só na descrição."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              rotulo="Fator kg"
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
        <SecaoCartao icone={CircleDot} titulo="Fita" descricao="Preço de tabela, vendida por unidade e por caixa.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              name="precoUnidade"
              rotulo="Preço por unidade"
              sufixo="R$"
              inputMode="decimal"
              value={campos.precoUnidade}
              onChange={(e) => alterar("precoUnidade")(e.target.value)}
            />
            <Campo
              name="precoCaixa"
              rotulo="Preço da caixa"
              sufixo="R$"
              inputMode="decimal"
              value={campos.precoCaixa}
              onChange={(e) => alterar("precoCaixa")(e.target.value)}
            />
            <Campo
              name="unidadesPorCaixa"
              rotulo="Unidades por caixa"
              inputMode="numeric"
              dica="Usado para converter caixa em unidade."
              value={campos.unidadesPorCaixa}
              onChange={(e) => alterar("unidadesPorCaixa")(e.target.value)}
            />
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
            <Campo
              name="micragem"
              rotulo="Micragem"
              inputMode="decimal"
              value={campos.micragem}
              onChange={(e) => alterar("micragem")(e.target.value)}
            />
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
          titulo={campos.familia === "BOBINA" ? "Bobina" : "Stretch"}
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
            <Campo
              name="larguraMm"
              rotulo="Largura"
              sufixo="mm"
              inputMode="decimal"
              value={campos.larguraMm}
              onChange={(e) => alterar("larguraMm")(e.target.value)}
            />
            <Campo
              name="micragem"
              rotulo="Micragem"
              inputMode="decimal"
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
          {aditivosDisponiveis.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aditivosDisponiveis.map((aditivo) => {
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

        {calculo && (
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

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Salvando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
