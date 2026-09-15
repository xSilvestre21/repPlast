"use client";

/**
 * Tabela de preço do material, dentro da página da indústria.
 *
 * Diferente da seção de aditivos, aqui CADA LINHA é editável. O motivo é o uso:
 * aditivo se cadastra uma vez e quase não muda, enquanto preço de material é
 * justamente a coisa que a indústria reajusta. Obrigar a remover e recadastrar
 * o PEAD para trocar 14,00 por 15,00 transformaria a operação mais comum da
 * tela na mais trabalhosa.
 */

import { Layers } from "lucide-react";
import { useActionState, useId, useState } from "react";

import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Campo,
  EstadoVazio,
  MensagemErro,
  Painel,
  SecaoCartao,
} from "@/components/ui";

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

type AcaoSalvar = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

function LinhaMaterial({
  material,
  salvar,
  salvarFaixas,
  remover,
}: {
  material: Material;
  salvar: AcaoSalvar;
  salvarFaixas: AcaoSalvar;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(salvar, {});
  const [estadoFaixas, enviarFaixas, salvandoFaixas] = useActionState(salvarFaixas, {});
  const [aberto, setAberto] = useState(material.faixas.length > 0);
  const painel = useId();

  const linhas = [
    ...material.faixas,
    ...Array.from({ length: FAIXAS_EM_BRANCO }, () => ({
      pesoDeKg: "",
      pesoAteKg: "",
      precoKg: "",
    })),
  ];

  return (
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {/*
          O nome viaja escondido porque é ele a chave do upsert. Editá-lo aqui
          não seria "corrigir o nome": criaria um material novo e deixaria o
          antigo para trás. Para trocar de nome, remove-se e cadastra-se.
        */}
        <form action={enviar} className="flex flex-wrap items-end gap-2 grow">
          <input type="hidden" name="nome" value={material.nome} />

          <div className="min-w-24 grow basis-24 self-center text-corpo font-medium">
            {material.nome}
          </div>

          <label className="basis-28 grow-0">
            <span className="sr-only">Preço do quilo de {material.nome}</span>
            <input
              name="precoKg"
              inputMode="decimal"
              required
              defaultValue={material.precoKg}
              className={`${CLASSE_CONTROLE} numerico`}
            />
          </label>

          <label className="basis-28 grow-0">
            <span className="sr-only">Valor mínimo do quilo de {material.nome}</span>
            <input
              name="precoMinimoKg"
              inputMode="decimal"
              placeholder="—"
              defaultValue={material.precoMinimoKg}
              className={`${CLASSE_CONTROLE} numerico`}
            />
          </label>

          <label className="basis-24 grow-0">
            <span className="sr-only">Densidade de {material.nome}</span>
            <input
              name="densidade"
              inputMode="decimal"
              placeholder="—"
              defaultValue={material.densidade}
              className={`${CLASSE_CONTROLE} numerico`}
            />
          </label>

          <Botao type="submit" variante="secundaria" tamanho="compacto" carregando={enviando}>
            {enviando ? "Salvando…" : "Salvar"}
          </Botao>
        </form>

        <BotaoTexto
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={painel}
          className="self-center"
        >
          {material.faixas.length > 0 ? `${material.faixas.length} faixa(s)` : "faixas"}
        </BotaoTexto>

        <form action={remover} className="self-center">
          <input type="hidden" name="materialId" value={material.id} />
          <BotaoTexto type="submit" perigoso aria-label={`Remover material ${material.nome}`}>
            remover
          </BotaoTexto>
        </form>
      </div>

      <MensagemErro>{estado.erro}</MensagemErro>

      <div id={painel} hidden={!aberto} className="pt-3 border-t border-filete">
        <form action={enviarFaixas} className="space-y-2">
          <input type="hidden" name="materialId" value={material.id} />

          <p className="text-mini text-tinta-2 leading-relaxed">
            Preço por faixa de peso do pedido, quando a indústria cobra mais barato na compra
            maior. Deixe em branco se o {material.nome} tem preço único. É referência na hora de
            cadastrar o produto — o preço gravado no produto continua sendo o que vale.
          </p>

          <div className="flex flex-wrap items-end gap-2 text-tinta-3">
            <span className="rotulo basis-24 grow-0">De (kg)</span>
            <span className="rotulo basis-24 grow-0">Até (kg)</span>
            <span className="rotulo basis-28 grow-0">R$ / kg</span>
          </div>

          {linhas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="basis-24 grow-0">
                <span className="sr-only">Peso inicial da faixa {i + 1}</span>
                <input
                  name="pesoDeKg"
                  inputMode="decimal"
                  placeholder="—"
                  defaultValue={f.pesoDeKg}
                  className={`${CLASSE_CONTROLE} numerico`}
                />
              </label>
              <label className="basis-24 grow-0">
                <span className="sr-only">Peso final da faixa {i + 1}</span>
                <input
                  name="pesoAteKg"
                  inputMode="decimal"
                  placeholder="—"
                  defaultValue={f.pesoAteKg}
                  className={`${CLASSE_CONTROLE} numerico`}
                />
              </label>
              <label className="basis-28 grow-0">
                <span className="sr-only">Preço da faixa {i + 1}</span>
                <input
                  name="precoKg"
                  inputMode="decimal"
                  placeholder={i < material.faixas.length ? "" : "35,20"}
                  defaultValue={f.precoKg}
                  className={`${CLASSE_CONTROLE} numerico`}
                />
              </label>
            </div>
          ))}

          <div className="flex justify-end">
            <Botao type="submit" variante="secundaria" tamanho="compacto" carregando={salvandoFaixas}>
              {salvandoFaixas ? "Salvando…" : "Salvar faixas"}
            </Botao>
          </div>

          <MensagemErro>{estadoFaixas.erro}</MensagemErro>
        </form>
      </div>
    </div>
  );
}

export function SecaoMateriais({
  materiais,
  salvar,
  salvarFaixas,
  remover,
}: {
  materiais: Material[];
  salvar: AcaoSalvar;
  salvarFaixas: AcaoSalvar;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={Layers}
      tom="menta"
      titulo="Materiais"
      descricao="Valor corrente do quilo, piso e densidade de cada tipo de material desta indústria. Ao cadastrar um saco, o valor aparece como sugestão no fator kg e a densidade entra preenchida — os dois passam a ser do produto, então reajustar a tabela não mexe no que já está cadastrado."
    >
      <Painel className="mb-4">
        {materiais.length === 0 ? (
          <EstadoVazio discreto icone={Layers}>
            Nenhum material cadastrado para esta indústria.
          </EstadoVazio>
        ) : (
          <>
            {/* O cabeçalho usa o MESMO padding das linhas: com `py-2` contra
                `py-2.5`, os rótulos ficavam 2px acima das colunas que nomeiam. */}
            <div className="flex flex-wrap items-end gap-2 px-3 py-2.5 text-tinta-3">
              <span className="rotulo min-w-24 grow basis-24">Tipo</span>
              <span className="rotulo basis-28 grow-0">Valor</span>
              <span className="rotulo basis-28 grow-0">Valor mín.</span>
              <span className="rotulo basis-24 grow-0">Densidade</span>
            </div>
            {materiais.map((material) => (
              <LinhaMaterial
                key={material.id}
                material={material}
                salvar={salvar}
                salvarFaixas={salvarFaixas}
                remover={remover}
              />
            ))}
          </>
        )}
      </Painel>

      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

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

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" carregando={enviando}>
            {enviando ? "Salvando…" : "Adicionar material"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
