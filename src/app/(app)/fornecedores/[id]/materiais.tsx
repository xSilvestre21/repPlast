"use client";

/**
 * Tabela de preço do material, dentro da página da indústria.
 *
 * Diferente da seção de aditivos, aqui CADA LINHA é editável. O motivo é o uso:
 * aditivo se cadastra uma vez e quase não muda, enquanto preço de material é
 * justamente a coisa que a indústria reajusta. Obrigar a remover e recadastrar
 * o PEAD para trocar 14,00 por 15,00 transformaria a operação mais comum da
 * tela na mais trabalhosa.
 *
 * É uma `Tabela` de verdade, e não linhas de flex com um cabeçalho solto em
 * cima: com cada linha medindo as próprias caixas, o "Valor" do cabeçalho
 * caía num x e os valores em outro, e a densidade escorregava conforme o nome
 * do material ao lado. Coluna de tabela alinha sozinha.
 */

import { Check, ChevronDown, Layers, Loader2 } from "lucide-react";
import { Fragment, useActionState, useEffect, useId, useRef, useState } from "react";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { ErroGeral, Formulario } from "@/components/formulario";
import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE_CELULA,
  CLASSE_ERRO,
  Campo,
  Celula,
  EstadoVazio,
  MensagemErro,
  SecaoCartao,
  Tabela,
} from "@/components/ui";
import { campoDaLinha } from "@/lib/erro-formulario";

import type { EstadoFormulario } from "../acoes";

export type Faixa = {
  pesoDeKg: string;
  pesoAteKg: string;
  precoKg: string;
};

export type Material = {
  id: string;
  nome: string;
  /** Já no padrão brasileiro, formatado pela página. */
  precoKg: string;
  precoMinimoKg: string;
  densidade: string;
  faixas: Faixa[];
};

/** Linhas em branco para a pessoa preencher sem precisar pedir "mais uma". */
const FAIXAS_EM_BRANCO = 4;

/** A caixa de número de uma linha de material. */
const CLASSE_CELULA = `${CLASSE_CONTROLE_CELULA} w-24 text-right numerico`;

/** Quanto tempo o "Salvo" fica na linha depois de gravar. */
const AVISO_SALVO_MS = 2000;


type AcaoSalvar = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/**
 * O que uma caixa de tabela precisa do estado da gravação: se o erro é dela,
 * e o que a pessoa tinha digitado — sem isto, o React devolve a caixa ao
 * valor antigo depois do envio, e a frase de erro fala de um número que já
 * não está lá.
 */
function caixaDaGravacao(estado: EstadoFormulario, nome: string, valorSalvo: string) {
  const comErro = estado.erro !== undefined && estado.campo === nome;
  return {
    "aria-invalid": comErro ? true : undefined,
    defaultValue: estado.erro ? (estado.valores?.[nome] ?? valorSalvo) : valorSalvo,
    // Não vai para o input: é a classe que a tela soma à da caixa.
    classeErro: comErro ? CLASSE_ERRO : "",
  };
}

/** O retorno da ação, carimbado com o momento em que gravou sem erro. */
type EstadoGravacao = EstadoFormulario & { salvoEm?: number };

/**
 * A ação de gravar, mais o aviso de que gravou.
 *
 * Sem botão, o "salvou?" precisa de outra resposta: na tabela de itens é o
 * total mudando, mas aqui nada ao lado muda quando o preço do quilo muda. O
 * carimbo de tempo faz o aviso reaparecer a cada gravação, mesmo quando duas
 * seguidas devolvem o mesmo `{}`.
 */
function useGravacao(salvar: AcaoSalvar) {
  const [estado, enviar, gravando] = useActionState<EstadoGravacao, FormData>(
    async (anterior, formData) => {
      const resultado = await salvar(anterior, formData);
      return resultado.erro ? resultado : { salvoEm: Date.now() };
    },
    {},
  );

  // A gravação cujo aviso já sumiu. O aviso aparece enquanto a última gravação
  // não for esta — e só o relógio mexe aqui, nunca o corpo do efeito.
  const [apagado, setApagado] = useState<number | undefined>();

  useEffect(() => {
    const carimbo = estado.salvoEm;
    if (!carimbo) return;
    const fim = setTimeout(() => setApagado(carimbo), AVISO_SALVO_MS);
    return () => clearTimeout(fim);
  }, [estado.salvoEm]);

  const salvo = estado.salvoEm !== undefined && estado.salvoEm !== apagado;

  return { estado, enviar, gravando, salvo: salvo && !gravando };
}

/** "Salvando…" e depois "Salvo" — com texto, e não só um ícone colorido. */
function Situacao({ gravando, salvo }: { gravando: boolean; salvo: boolean }) {
  return (
    // Largura reservada: "Salvando…" e "Salvo" têm tamanhos diferentes, e sem
    // isto a coluna de ações encolhia e empurrava a tabela inteira de lado.
    <span
      aria-live="polite"
      className="inline-flex w-20 items-center justify-end gap-1 text-mini text-tinta-3"
    >
      {gravando ? (
        <>
          <Loader2 size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" />
          Salvando…
        </>
      ) : salvo ? (
        <>
          <Check size={13} strokeWidth={2.5} className="text-verde" aria-hidden="true" />
          Salvo
        </>
      ) : null}
    </span>
  );
}

function LinhaMaterial({
  material,
  salvar,
  salvarFaixas,
  remover,
  editavel,
}: {
  material: Material;
  salvar: AcaoSalvar;
  salvarFaixas: AcaoSalvar;
  remover: AcaoSalvar;
  editavel: boolean;
}) {
  const linha = useGravacao(salvar);
  const faixas = useGravacao(salvarFaixas);
  const [aberto, setAberto] = useState(false);

  const idFormulario = useId();
  const idPainel = useId();
  const idErro = useId();

  /*
   * O que o campo valia quando a pessoa entrou nele — a mesma regra da tabela
   * de itens: só grava quem mudou. Comparar com o valor do material não
   * serviria, porque "14" digitado num campo que se lê "14,00" regravaria a
   * linha sem nada ter mudado.
   */
  const valorAoEntrar = useRef("");

  function gravar(campo: HTMLInputElement) {
    if (campo.value === valorAoEntrar.current) return;
    valorAoEntrar.current = campo.value;
    campo.form?.requestSubmit();
  }

  const gravaSozinho = {
    form: idFormulario,
    inputMode: "decimal" as const,
    "aria-describedby": linha.estado.erro ? idErro : undefined,
    onFocus: (evento: React.FocusEvent<HTMLInputElement>) => {
      valorAoEntrar.current = evento.currentTarget.value;
    },
    onBlur: (evento: React.FocusEvent<HTMLInputElement>) => gravar(evento.currentTarget),
    onKeyDown: (evento: React.KeyboardEvent<HTMLInputElement>) => {
      if (evento.key !== "Enter") return;
      // Sem isto o Enter faria a submissão implícita do navegador por cima da
      // ação do React, e a página recarregaria.
      evento.preventDefault();
      gravar(evento.currentTarget);
    },
    className: CLASSE_CELULA,
  };

  const { classeErro: erroPrecoKg, ...precoKg } = caixaDaGravacao(
    linha.estado,
    "precoKg",
    material.precoKg,
  );
  const { classeErro: erroPrecoMinimoKg, ...precoMinimoKg } = caixaDaGravacao(
    linha.estado,
    "precoMinimoKg",
    material.precoMinimoKg,
  );
  const { classeErro: erroDensidade, ...densidade } = caixaDaGravacao(
    linha.estado,
    "densidade",
    material.densidade,
  );

  // As linhas de faixa e de erro atravessam a tabela inteira. Em leitura não há
  // a coluna de ações.
  const colunas = editavel ? 6 : 5;

  const temFaixas = material.faixas.length > 0;
  // Em leitura, um material sem faixa não tem o que abrir.
  const podeAbrir = editavel || temFaixas;

  return (
    <>
      <tr>
        <Celula className="font-medium text-tinta">
          {/*
            O nome viaja escondido porque é ele a chave do upsert. Editá-lo aqui
            não seria "corrigir o nome": criaria um material novo e deixaria o
            antigo para trás. Para trocar de nome, remove-se e cadastra-se.
          */}
          <form id={idFormulario} action={linha.enviar}>
            <input type="hidden" name="nome" value={material.nome} />
          </form>
          {material.nome}
        </Celula>

        {editavel ? (
          <>
            <Celula alinhamento="numero">
              <input
                {...gravaSozinho}
                {...precoKg}
                className={`${CLASSE_CELULA} ${erroPrecoKg}`}
                name="precoKg"
                required
                aria-label={`Valor do quilo de ${material.nome}`}
              />
            </Celula>
            <Celula alinhamento="numero">
              <input
                {...gravaSozinho}
                {...precoMinimoKg}
                className={`${CLASSE_CELULA} ${erroPrecoMinimoKg}`}
                name="precoMinimoKg"
                placeholder="—"
                aria-label={`Valor mínimo do quilo de ${material.nome}`}
              />
            </Celula>
            <Celula alinhamento="numero">
              <input
                {...gravaSozinho}
                {...densidade}
                className={`${CLASSE_CELULA} ${erroDensidade}`}
                name="densidade"
                placeholder="—"
                aria-label={`Densidade de ${material.nome}`}
              />
            </Celula>
          </>
        ) : (
          <>
            {/* Em leitura, texto — e não caixas apagadas: campo desabilitado
                diz "você não pode", quando aqui o que se diz é "o valor é este". */}
            <Celula alinhamento="numero">{material.precoKg}</Celula>
            <Celula alinhamento="numero" className="text-tinta-2">
              {material.precoMinimoKg || "—"}
            </Celula>
            <Celula alinhamento="numero" className="text-tinta-2">
              {material.densidade || "—"}
            </Celula>
          </>
        )}

        <Celula>
          {podeAbrir ? (
            <button
              type="button"
              onClick={() => setAberto((a) => !a)}
              aria-expanded={aberto}
              aria-controls={idPainel}
              className="inline-flex items-center gap-1 text-mini font-medium text-tinta-2
                hover:text-carimbo cursor-pointer transition-colors"
            >
              <ChevronDown
                size={14}
                strokeWidth={2}
                aria-hidden="true"
                className={`transition-transform duration-150 ${aberto ? "rotate-180" : ""}`}
              />
              {temFaixas
                ? `${material.faixas.length} faixa${material.faixas.length > 1 ? "s" : ""}`
                : "Adicionar"}
            </button>
          ) : (
            <span className="text-tinta-3">—</span>
          )}
        </Celula>

        {editavel && (
          <Celula alinhamento="acao">
            <div className="flex items-center justify-end gap-3">
              <Situacao gravando={linha.gravando} salvo={linha.salvo} />
              <AcaoComRecusa
                acao={remover}
                confirmar={{
                  titulo: `Remover o material ${material.nome}?`,
                  texto:
                    "Ele sai da tabela de preço desta indústria, com as faixas de peso, e deixa de " +
                    "aparecer para escolher em produtos novos. Os produtos já cadastrados com ele " +
                    "não mudam: guardam o material e o preço que tinham.",
                  rotulo: "Remover",
                }}
              >
                <input type="hidden" name="materialId" value={material.id} />
                <BotaoTexto type="submit" perigoso aria-label={`Remover material ${material.nome}`}>
                  remover
                </BotaoTexto>
              </AcaoComRecusa>
            </div>
          </Celula>
        )}
      </tr>

      {linha.estado.erro && (
        <tr>
          <td colSpan={colunas} className="px-3 pb-2.5">
            <p id={idErro} role="alert" className="text-mini text-perigo">
              {linha.estado.erro}
            </p>
          </td>
        </tr>
      )}

      {aberto && (
        <tr id={idPainel}>
          <td colSpan={colunas} className="px-3 pb-4 pt-1">
            <PainelFaixas
              // Remonta ao gravar: as faixas voltam do banco em ordem de peso,
              // e as caixas não controladas guardariam a ordem digitada.
              key={JSON.stringify(material.faixas)}
              material={material}
              editavel={editavel}
              enviar={faixas.enviar}
              gravando={faixas.gravando}
              salvo={faixas.salvo}
              estado={faixas.estado}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * As faixas de preço por peso de um material.
 *
 * Gravam como bloco, e não campo a campo: uma faixa é De + Até + preço, e
 * gravar no meio dela recusaria a linha pela metade com "informe o preço". O
 * bloco grava quando o foco SAI dele — é o "terminei" de quem preenche uma
 * tabelinha, sem botão para lembrar de clicar.
 */
function PainelFaixas({
  material,
  editavel,
  enviar,
  gravando,
  salvo,
  estado,
}: {
  material: Material;
  editavel: boolean;
  enviar: (formData: FormData) => void;
  gravando: boolean;
  salvo: boolean;
  estado: EstadoFormulario;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const aoEntrar = useRef<string | null>(null);

  const retrato = () =>
    formulario.current
      ? new URLSearchParams(
          new FormData(formulario.current) as unknown as Record<string, string>,
        ).toString()
      : "";

  // As linhas em branco são para preencher; em leitura, só as faixas que existem.
  const linhas = [
    ...material.faixas,
    ...Array.from({ length: editavel ? FAIXAS_EM_BRANCO : 0 }, () => ({
      pesoDeKg: "",
      pesoAteKg: "",
      precoKg: "",
    })),
  ];

  const celula = `${CLASSE_CONTROLE_CELULA} w-24 text-right numerico`;

  /** A faixa com erro, para a frase ir logo embaixo dela. */
  const faixaComErro = linhas.findIndex((_, i) =>
    ["pesoDeKg", "pesoAteKg", "precoKg"].some((nome) => estado.campo === campoDaLinha(nome, i)),
  );

  return (
    // Sem fundo próprio: as caixas de digitar já são `folha-2`, e um painel da
    // mesma cor as apagava — as faixas pareciam texto solto, não campos.
    <div className="rounded-suave border border-filete p-4 space-y-3 max-w-xl">
      <p className="text-mini text-tinta-2 leading-relaxed">
        Preço por faixa de peso do pedido, quando a indústria cobra mais barato na compra maior.
        Deixe em branco se o {material.nome} tem preço único. É referência na hora de cadastrar
        o produto — o preço gravado no produto continua sendo o que vale.
      </p>

      <form
        ref={formulario}
        action={enviar}
        onFocus={() => {
          // Só a primeira entrada vale: andar entre as caixas do próprio bloco
          // também dispara foco, e reescrever o retrato apagaria a mudança.
          if (aoEntrar.current === null) aoEntrar.current = retrato();
        }}
        onBlur={(evento) => {
          if (evento.currentTarget.contains(evento.relatedTarget)) return;
          const mudou = aoEntrar.current !== null && aoEntrar.current !== retrato();
          aoEntrar.current = null;
          if (mudou) evento.currentTarget.requestSubmit();
        }}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter") return;
          evento.preventDefault();
          aoEntrar.current = retrato();
          evento.currentTarget.requestSubmit();
        }}
      >
        <input type="hidden" name="materialId" value={material.id} />

        <table className="border-collapse text-corpo">
          <thead>
            <tr>
              <th scope="col" className="pr-2 pb-1.5 text-right text-mini font-medium text-tinta-3">
                De (kg)
              </th>
              <th scope="col" className="pr-2 pb-1.5 text-right text-mini font-medium text-tinta-3">
                Até (kg)
              </th>
              <th scope="col" className="pb-1.5 text-right text-mini font-medium text-tinta-3">
                R$ / kg
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((f, i) =>
              editavel ? (
                <Fragment key={i}>
                  <tr>
                    {(
                      [
                        ["pesoDeKg", f.pesoDeKg, `Peso inicial da faixa ${i + 1}`, "—"],
                        ["pesoAteKg", f.pesoAteKg, `Peso final da faixa ${i + 1}`, "—"],
                        // Exemplo só na primeira linha em branco: repetido em
                        // todas, parecia preço já gravado.
                        ["precoKg", f.precoKg, `Preço da faixa ${i + 1}`, i === material.faixas.length ? "35,20" : ""],
                      ] as const
                    ).map(([nome, valorSalvo, rotulo, placeholder]) => {
                      const { classeErro, ...caixa } = caixaDaGravacao(
                        estado,
                        campoDaLinha(nome, i),
                        valorSalvo,
                      );
                      return (
                        <td key={nome} className={nome === "precoKg" ? "py-1" : "pr-2 py-1"}>
                          <input
                            {...caixa}
                            name={nome}
                            data-campo={campoDaLinha(nome, i)}
                            inputMode="decimal"
                            placeholder={placeholder}
                            aria-label={rotulo}
                            className={`${celula} ${classeErro}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  {i === faixaComErro && (
                    <tr>
                      <td colSpan={3} className="pb-1.5">
                        <p role="alert" className="text-mini text-perigo max-w-sm">
                          {estado.erro}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ) : (
                <tr key={i} className="numerico">
                  <td className="pr-6 py-1 text-right">{f.pesoDeKg || "—"}</td>
                  <td className="pr-6 py-1 text-right">{f.pesoAteKg || "—"}</td>
                  <td className="py-1 text-right font-medium">{f.precoKg}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </form>

      {editavel && (
        <div className="flex items-center justify-between gap-3 min-h-5">
          <p className="text-mini text-tinta-3">Grava ao sair da tabela.</p>
          <Situacao gravando={gravando} salvo={salvo} />
        </div>
      )}

      {/* Erro que não é de uma faixa só — o material sumiu, por exemplo. */}
      {faixaComErro === -1 && <MensagemErro>{estado.erro}</MensagemErro>}
    </div>
  );
}

export function SecaoMateriais({
  materiais,
  salvar,
  salvarFaixas,
  remover,
  editavel,
}: {
  materiais: Material[];
  salvar: AcaoSalvar;
  salvarFaixas: AcaoSalvar;
  remover: AcaoSalvar;
  /** Ficha aberta para leitura: a tabela aparece, reajustar exige Editar. */
  editavel: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={Layers}
      tom="menta"
      titulo="Materiais"
      descricao="Valor corrente do quilo, piso e densidade de cada tipo de material desta indústria. Ao cadastrar um saco, o valor aparece como sugestão no fator kg e a densidade entra preenchida — os dois passam a ser do produto, então reajustar a tabela não mexe no que já está cadastrado."
    >
      {materiais.length === 0 ? (
        <div className={editavel ? "mb-4" : ""}>
          <EstadoVazio discreto icone={Layers}>
            Nenhum material cadastrado para esta indústria.
          </EstadoVazio>
        </div>
      ) : (
        <Tabela
          className={editavel ? "mb-5" : ""}
          colunas={[
            { rotulo: "Material" },
            { rotulo: "Valor (R$/kg)", alinhamento: "numero", largura: "w-32" },
            { rotulo: "Mínimo (R$/kg)", alinhamento: "numero", largura: "w-32" },
            { rotulo: "Densidade", alinhamento: "numero", largura: "w-32" },
            { rotulo: "Faixas de peso", largura: "w-36" },
            ...(editavel
              ? [
                  {
                    rotulo: <span className="sr-only">Ações</span>,
                    alinhamento: "acao" as const,
                    largura: "w-44",
                  },
                ]
              : []),
          ]}
        >
          {materiais.map((material) => (
            <LinhaMaterial
              key={material.id}
              material={material}
              salvar={salvar}
              salvarFaixas={salvarFaixas}
              remover={remover}
              editavel={editavel}
            />
          ))}
        </Tabela>
      )}

      {editavel && (
        <Formulario
          estado={estado}
          action={enviar}
          className="space-y-4 pt-5 border-t border-filete"
        >

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              name="nome"
              rotulo="Tipo"
              required
              placeholder="PEAD"
              dica="Sai impresso na descrição do saco."
            />
            <Campo
              name="precoKg"
              rotulo="Valor"
              inputMode="decimal"
              required
              placeholder="14,00"
              sufixo="R$"
              dica="Por quilo. Vira o fator kg sugerido."
            />
            <Campo
              name="precoMinimoKg"
              rotulo="Valor mínimo"
              inputMode="decimal"
              placeholder="12,00"
              sufixo="R$"
              dica="Opcional. Abaixo dele o produto avisa, mas salva."
            />
            <Campo
              name="densidade"
              rotulo="Densidade"
              inputMode="decimal"
              placeholder="0,1"
              dica="Entra na conta do peso. Vazia, o produto usa 0,1."
            />
          </div>

          <ErroGeral />
          <div className="flex justify-end">
            <Botao type="submit" variante="secundaria" carregando={enviando}>
              {enviando ? "Salvando…" : "Adicionar material"}
            </Botao>
          </div>
        </Formulario>
      )}
    </SecaoCartao>
  );
}
