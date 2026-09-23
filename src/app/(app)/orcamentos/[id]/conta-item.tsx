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

import { Botao, BotaoTexto, Campo, MensagemErro, Selecao, formatarMoeda } from "@/components/ui";
import { CAMPO_IPI, CAMPO_IPI_DEFINIDO } from "@/lib/ipi-do-formulario";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { escreverNumeroBr, lerNumeroBr } from "@/lib/numero-br";
import { DENSIDADE_PADRAO, pesoMilheiroKg } from "@/lib/precificacao";
import {
  ROTULO_UNIDADE,
  type Familia,
  type ProdutoPrecificavel,
  type UnidadeVenda,
  precoUnitario,
  unidadesDaFamilia,
} from "@/lib/produto-preco";

import type { EstadoFormulario } from "../acoes";
import type { Conta } from "../../produtos/leitura";
import type { AditivoOpcao, MaterialOpcao } from "../../produtos/formulario";

/**
 * O que se escolhe na tela: o TIPO, não a família.
 *
 * Quase sempre são a mesma coisa. O shrink é a exceção: o representante vende
 * e fala dele como coisa própria, mas no cadastro ele é STRETCH — por kg, sem
 * medida de saco —, que é como a importação do SICOV já o grava. O tipo vive
 * só aqui; o que vai para o servidor é a família.
 *
 * `nome` é o que abre a descrição impressa (a nomenclatura dos pedidos 133 e
 * 146: tipo, medidas sem unidade, complemento). Vem preenchido para a
 * descrição se montar sozinha; o saco não tem, porque ali o que abre são as
 * medidas e o material vem depois.
 */
const TIPOS = [
  { valor: "SACO", familia: "SACO", rotulo: "Saco plástico", nome: "" },
  { valor: "FITA", familia: "FITA", rotulo: "Fita", nome: "Fita adesiva" },
  { valor: "STRETCH", familia: "STRETCH", rotulo: "Stretch", nome: "FILME STRETCH" },
  { valor: "SHRINK", familia: "STRETCH", rotulo: "Shrink", nome: "FILME SHRINK" },
  { valor: "BOBINA", familia: "BOBINA", rotulo: "Bobina", nome: "BOBINA" },
  { valor: "AVULSO", familia: "AVULSO", rotulo: "Avulso", nome: "" },
] as const satisfies readonly { valor: string; familia: Familia; rotulo: string; nome: string }[];

type Tipo = (typeof TIPOS)[number];

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

const tipoPorValor = (valor: string): Tipo => TIPOS.find((t) => t.valor === valor) ?? TIPOS[0];

const LISTA_MATERIAIS = "materiais-da-proposta";

const CONTA_VAZIA: Conta = {
  familia: "SACO",
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
  adicionar,
}: {
  materiais: MaterialOpcao[];
  aditivos: AditivoOpcao[];
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [conta, setConta] = useState<Conta>(CONTA_VAZIA);
  const [tipo, setTipo] = useState<Tipo>(TIPOS[0]);
  const [modoFita, setModoFita] = useState<ModoFita>(MODOS_FITA[0]);
  const [descricaoManual, setDescricaoManual] = useState<string | null>(null);
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<UnidadeVenda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [precoManual, setPrecoManual] = useState<string | null>(null);

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
        setTipo(TIPOS[0]);
        setModoFita(MODOS_FITA[0]);
        setDescricaoManual(null);
        setUnidadeEscolhida("");
        setQuantidade("");
        setPrecoManual(null);
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
  const ehShrink = tipo.valor === "SHRINK";

  /**
   * Troca o tipo e, com ele, o nome que abre a descrição.
   *
   * Só reescreve o nome se ele ainda for o padrão do tipo anterior (ou vazio):
   * o que a pessoa digitou ali — "ECOFILME", "Fita adesiva marrom" — é dela, e
   * trocar de tipo não pode apagar.
   */
  function escolherTipo(valor: string) {
    const novo = tipoPorValor(valor);

    setConta((atual) => ({
      ...atual,
      familia: novo.familia,
      material:
        atual.material.trim() === "" || atual.material === tipo.nome ? novo.nome : atual.material,
    }));
    setTipo(novo);
    setPrecoManual(null);
  }

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
    aditivos: aditivosEscolhidos,
  };

  /*
   * A unidade: a do avulso é a do preço digitado; a da fita, a do modo
   * escolhido lá em cima; nas outras, as da família. Escolha que deixou de
   * valer (trocou de família) cai na primeira.
   */
  const unidades: UnidadeVenda[] = ehAvulso
    ? [conta.unidadeAvulsa as UnidadeVenda]
    : ehFita
      ? [modoFita.unidade]
      : unidadesDaFamilia(familia);
  const unidade =
    unidadeEscolhida && unidades.includes(unidadeEscolhida) ? unidadeEscolhida : unidades[0];

  const precoCalculado = precoUnitario(precificavel, unidade);

  // Precisão cheia no campo, como no catálogo: cortar em centavos faria o
  // total errar o centavo que a indústria não erra.
  const preco =
    precoManual ?? (precoCalculado ? escreverNumeroBr(precoCalculado.toFixed(6), 2, 6) : "");

  const sufixos = aditivosEscolhidos.map((a) => a.sufixoDescricao);

  const descricaoGerada = (() => {
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
    <form
      action={enviar}
      className="space-y-4"
    >
      <MensagemErro>{estado.erro}</MensagemErro>

      <p className="text-corpo text-tinta-2 leading-relaxed">
        Sem produto pronto: quem ainda não é cliente não tem produto cadastrado. Faça a conta do
        item — ele entra na soma e só vira produto depois de o cliente ser cadastrado.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
        <Selecao
          name="tipo"
          rotulo="Tipo"
          value={tipo.valor}
          onChange={(e) => escolherTipo(e.target.value)}
          dica={ehShrink ? "Vendido por kg; entra no cadastro como stretch." : undefined}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </Selecao>
        <input type="hidden" name="familia" value={conta.familia} />

        <div>
          <Campo
            name="material"
            rotulo={ehSaco ? "Material" : "Nome na descrição"}
            list={ehSaco && materiais.length > 0 ? LISTA_MATERIAIS : undefined}
            placeholder={ehSaco ? "PEAD" : tipo.nome || "Nome do item"}
            dica={
              ehSaco && materialDaTabela
                ? `Tabela desta indústria: ${formatarMoeda(materialDaTabela.precoKg)} / kg.`
                : undefined
            }
            value={conta.material}
            onChange={(e) => escolherMaterial(e.target.value)}
          />
          {ehSaco && materiais.length > 0 && (
            <datalist id={LISTA_MATERIAIS}>
              {materiais.map((m) => (
                <option key={m.nome} value={m.nome} />
              ))}
            </datalist>
          )}
        </div>

        <Campo
          name="complemento"
          rotulo="Complemento"
          placeholder={
            ehSaco
              ? "AZUL"
              : ehFita
                ? "transparente"
                : ehAvulso
                  ? ""
                  : ehShrink
                    ? "BOBINA COM 20 KG"
                    : "BOBINA 4KG PESO LÍQUIDO"
          }
          value={conta.complemento}
          onChange={(e) => alterar("complemento")(e.target.value)}
        />
      </div>

      {ehSaco && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:items-start">
          <CampoNumero rotulo="Largura" sufixo="cm" nome="larguraCm" conta={conta} alterar={alterar} obrigatorio />
          <CampoNumero rotulo="Comprimento" sufixo="cm" nome="comprimentoCm" conta={conta} alterar={alterar} obrigatorio />
          <CampoNumero rotulo="Espessura" sufixo="mm" nome="espessuraMm" conta={conta} alterar={alterar} obrigatorio placeholder="0,08" />
          <Campo
            name="sanfona"
            rotulo="Sanfona"
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
        <div>
          <span className="rotulo block mb-1.5">Aditivos</span>
          <div className="flex flex-wrap gap-2">
            {aditivos.map((aditivo) => {
              const marcado = conta.aditivos.includes(aditivo.id);

              return (
                <label
                  key={aditivo.id}
                  className={`flex items-center gap-2 rounded-suave border px-3 py-1.5 text-corpo cursor-pointer transition-colors ${
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
                    onChange={(e) => {
                      setConta((atual) => ({
                        ...atual,
                        aditivos: e.target.checked
                          ? [...atual.aditivos, aditivo.id]
                          : atual.aditivos.filter((id) => id !== aditivo.id),
                      }));
                      setPrecoManual(null);
                    }}
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
        </div>
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
          inputMode="decimal"
          required
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
        />

        <Campo
          name="precoUnitario"
          rotulo="Preço"
          inputMode="decimal"
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
          <span className="rotulo block mb-1.5 invisible select-none" aria-hidden="true">
            &nbsp;
          </span>
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
    </form>
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
      inputMode="decimal"
      required={obrigatorio}
      placeholder={placeholder}
      value={conta[nome]}
      onChange={(e) => alterar(nome)(e.target.value)}
    />
  );
}
