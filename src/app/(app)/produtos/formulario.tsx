"use client";

import { useActionState, useMemo, useState } from "react";

import {
  Botao,
  Campo,
  Cartao,
  MensagemErro,
  SecaoCartao,
  Selecao,
  formatarMoeda,
} from "@/components/ui";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { lerNumeroBr } from "@/lib/numero-br";
import { type Aditivo, fatorEfetivo, precoMilheiroSaco } from "@/lib/precificacao";

import type { EstadoFormulario } from "./acoes";

export type AditivoOpcao = Aditivo & { id: string };

export type FornecedorOpcao = {
  id: string;
  nome: string;
  fatorKgPadrao: string | null;
  aditivos: AditivoOpcao[];
};

export type ValoresProduto = {
  fornecedorId: string;
  familia: string;
  codigoFornecedor: string;
  descricao: string;
  material: string;
  complemento: string;
  larguraCm: string;
  comprimentoCm: string;
  espessuraMm: string;
  sanfona: string;
  fatorKg: string;
  larguraMm: string;
  metragemM: string;
  micragem: string;
  unidadesPorCaixa: string;
  precoUnidade: string;
  precoCaixa: string;
  precoKg: string;
  aditivos: string[];
};

export const VALORES_VAZIOS: ValoresProduto = {
  fornecedorId: "",
  familia: "SACO",
  codigoFornecedor: "",
  descricao: "",
  material: "",
  complemento: "",
  larguraCm: "",
  comprimentoCm: "",
  espessuraMm: "",
  sanfona: "",
  fatorKg: "",
  larguraMm: "",
  metragemM: "",
  micragem: "",
  unidadesPorCaixa: "",
  precoUnidade: "",
  precoCaixa: "",
  precoKg: "",
  aditivos: [],
};

const FAMILIAS = [
  { valor: "SACO", rotulo: "Saco plástico" },
  { valor: "FITA", rotulo: "Fita" },
  { valor: "STRETCH", rotulo: "Stretch" },
  { valor: "BOBINA", rotulo: "Bobina" },
] as const;

export function FormularioProduto({
  fornecedores,
  valores,
  acao,
  rotuloEnvio,
}: {
  fornecedores: FornecedorOpcao[];
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

  // Memoizado porque `?? []` criaria um array novo a cada render, o que
  // invalidaria as memoizações seguintes — inclusive a do cálculo do preço.
  const aditivosDisponiveis = useMemo(
    () => fornecedores.find((f) => f.id === campos.fornecedorId)?.aditivos ?? [],
    [fornecedores, campos.fornecedorId],
  );

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

    return {
      largura,
      comprimento,
      espessura,
      fator,
      fatorEfetivo: fatorEfetivo(fator, aditivosCalc),
      precoMilheiro: precoMilheiroSaco({
        larguraCm: largura,
        comprimentoCm: comprimento,
        espessuraMm: espessura,
        fatorKg: fator,
        aditivos: aditivosCalc,
      }),
    };
  }, [campos, aditivosEscolhidos]);

  const ehSaco = campos.familia === "SACO";
  const ehFita = campos.familia === "FITA";

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao titulo="Origem">
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
              setCampos((atual) => ({
                ...atual,
                fornecedorId: novo,
                aditivos: [],
                fatorKg: atual.fatorKg || (sugestao ? formatarNumero(sugestao, 2) : ""),
              }));
            }}
          >
            <option value="">Escolha…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>

          <Selecao
            name="familia"
            rotulo="Família"
            value={campos.familia}
            onChange={(e) => alterar("familia")(e.target.value)}
            dica={ehSaco ? "Só o saco tem preço calculado por fórmula." : "Preço de tabela."}
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

          <Campo
            name="material"
            rotulo={ehSaco ? "Material" : "Tipo do produto"}
            dica={
              ehSaco
                ? "Sai depois das medidas, como PEAD no pedido 2253."
                : "Abre a descrição, como “Fita adesiva” ou “FILM STRETCH”."
            }
            placeholder={ehSaco ? "PEAD" : "FILM STRETCH"}
            value={campos.material}
            // No saco a indústria imprime em maiúsculo; nas outras famílias os
            // pedidos reais trazem "Fita adesiva", com caixa mista.
            onChange={(e) =>
              alterar("material")(ehSaco ? e.target.value.toUpperCase() : e.target.value)
            }
          />

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
              placeholder="13,50"
              value={campos.fatorKg}
              onChange={(e) => alterar("fatorKg")(e.target.value)}
            />
          </div>
        </SecaoCartao>
      )}

      {ehFita && (
        <SecaoCartao titulo="Fita" descricao="Preço de tabela, vendida por unidade e por caixa.">
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

      {!ehSaco && !ehFita && (
        <SecaoCartao
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
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      marcado
                        ? "border-acento bg-acento-fraco text-texto"
                        : "border-borda hover:border-borda-forte text-texto-suave"
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
                      className="accent-acento"
                    />
                    {aditivo.nome}
                    <span className="text-xs text-texto-fraco numerico">
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
          <button
            type="button"
            onClick={() => setDescricaoManual(null)}
            className="mt-2 text-xs text-texto-fraco hover:text-acento transition-colors"
          >
            Voltar para a gerada: <span className="font-mono">{descricaoGerada}</span>
          </button>
        )}

        {calculo && (
          <Cartao className="mt-4 p-4 bg-fundo">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div className="text-sm text-texto-suave">Preço do milheiro</div>
              <div className="text-2xl font-semibold texto-gradiente numerico">
                {formatarMoeda(calculo.precoMilheiro.toNumber())}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-borda text-xs text-texto-fraco font-mono numerico leading-relaxed">
              {formatarNumero(calculo.largura)} × {formatarNumero(calculo.comprimento)} ×{" "}
              {formatarNumero(calculo.espessura, 2)} ×{" "}
              {formatarNumero(calculo.fatorEfetivo.toNumber(), 2)} ÷ 10
              {aditivosEscolhidos.length > 0 && (
                <div className="mt-1">
                  fator {formatarNumero(calculo.fator, 2)} + aditivos ={" "}
                  {formatarNumero(calculo.fatorEfetivo.toNumber(), 2)}
                </div>
              )}
            </div>
          </Cartao>
        )}
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
