"use client";

import { Campo, Selecao } from "./ui";
import { CampoComplemento } from "./campo-complemento";
import { type OpcaoBuscavel, SelecaoBuscavel } from "./selecao-buscavel";
import type { UnidadeVenda } from "@/lib/produto-preco";
import {
  COMPLEMENTOS_TAMPA,
  MATERIAIS_TAMPA,
  type CamposDaEmbalagem,
  type TipoProduto,
  camposDaMedida,
  unidadeDaCapacidade,
  unidadeDeVenda,
} from "@/lib/tipos-produto";

/*
 * Os campos dos tipos vendidos por milheiro, iguais no cadastro de produto e no
 * item por conta da proposta. Saem soltos, sem caixa em volta: cada tela os põe
 * na sua própria grade.
 */

type AoMudar = (campo: keyof CamposDaEmbalagem, valor: string) => void;

const OPCOES_MATERIAL_TAMPA = MATERIAIS_TAMPA.map((m) => ({ id: m, rotulo: m }));

function CampoMedida({
  name,
  rotulo,
  sufixo,
  placeholder,
  required,
  valores,
  aoMudar,
}: {
  name: keyof CamposDaEmbalagem;
  rotulo: string;
  sufixo?: string;
  placeholder?: string;
  required?: boolean;
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  return (
    <Campo
      name={name}
      rotulo={rotulo}
      sufixo={sufixo}
      numero="decimal"
      required={required}
      placeholder={placeholder}
      value={valores[name]}
      onChange={(e) => aoMudar(name, e.target.value)}
    />
  );
}

/**
 * As medidas do tipo: a capacidade (ou o peso, na pré-forma), com a escolha da
 * unidade; nos outros, os campos que `camposDaMedida` lista — as três da caixa,
 * o diâmetro, a aba da cantoneira.
 */
export function MedidasEmbalagem({
  tipo,
  valores,
  aoMudar,
}: {
  tipo: TipoProduto;
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  if (tipo.medida !== "CAPACIDADE") {
    return (
      <>
        {camposDaMedida(tipo).map((c) => (
          <CampoMedida
            key={c.campo}
            name={c.campo}
            rotulo={c.rotulo}
            sufixo={c.sufixo}
            placeholder={c.exemplo}
            required={c.obrigatorio}
            valores={valores}
            aoMudar={aoMudar}
          />
        ))}
      </>
    );
  }

  const unidades = tipo.unidadesCapacidade ?? [];
  const unidade = unidadeDaCapacidade(tipo, valores.capacidadeUnidade);

  return (
    <>
      <CampoMedida
        name="capacidade"
        rotulo={tipo.rotuloCapacidade?.rotulo ?? "Capacidade"}
        sufixo={unidades.length === 1 ? unidade : undefined}
        placeholder={tipo.exemploCapacidade}
        required={!tipo.medidaOpcional}
        valores={valores}
        aoMudar={aoMudar}
      />

      {/* A bombona é só em litros: não há o que escolher, mas a unidade vai junto. */}
      {unidades.length > 1 ? (
        <Selecao
          name="capacidadeUnidade"
          rotulo="Unidade da capacidade"
          value={unidade}
          onChange={(e) => aoMudar("capacidadeUnidade", e.target.value)}
        >
          {unidades.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Selecao>
      ) : (
        <input type="hidden" name="capacidadeUnidade" value={unidade} />
      )}
    </>
  );
}

const NOME_DA_UNIDADE: Record<UnidadeVenda, string> = {
  MIL: "Milheiro",
  UN: "Unidade",
  KG: "Quilo",
  CX: "Caixa",
};

const ROTULO_DO_PRECO: Record<UnidadeVenda, string> = {
  MIL: "Preço do milheiro",
  UN: "Preço da unidade",
  KG: "Preço do quilo",
  CX: "Preço da caixa",
};

/**
 * O preço do tipo: o do milheiro, ou — no tipo que escolhe a unidade — o da
 * unidade escolhida ao lado.
 */
export function PrecoDaEmbalagem({
  tipo,
  valores,
  aoMudar,
}: {
  tipo: TipoProduto;
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  const unidade = unidadeDeVenda(tipo, valores.unidadeAvulsa);

  return (
    <>
      {tipo.unidadesVenda && (
        <Selecao
          name="unidadeAvulsa"
          rotulo="Vendido por"
          value={unidade}
          onChange={(e) => aoMudar("unidadeAvulsa", e.target.value)}
          dica={tipo.dicaUnidade}
        >
          {tipo.unidadesVenda.map((u) => (
            <option key={u} value={u}>
              {NOME_DA_UNIDADE[u]}
            </option>
          ))}
        </Selecao>
      )}
      <CampoMedida
        name="precoAvulso"
        rotulo={ROTULO_DO_PRECO[unidade]}
        sufixo="R$"
        required
        valores={valores}
        aoMudar={aoMudar}
      />
    </>
  );
}

/** A tampa que acompanha o frasco ou a bombona no conjunto. */
export function CamposDaTampa({
  valores,
  aoMudar,
}: {
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  return (
    <>
      <CampoMedida name="diametroMm" rotulo="Diâmetro" sufixo="mm" placeholder="28" required valores={valores} aoMudar={aoMudar} />

      <SelecaoBuscavel
        livre
        name="materialTampa"
        rotulo="Material da tampa"
        opcoes={OPCOES_MATERIAL_TAMPA}
        value={valores.materialTampa}
        aoEscolher={(texto) => aoMudar("materialTampa", texto)}
        dica="Escolha da lista ou digite outro."
      />

      <CampoComplemento
        name="complementoTampa"
        rotulo="Complemento da tampa"
        grupos={COMPLEMENTOS_TAMPA}
        value={valores.complementoTampa}
        aoMudar={(texto) => aoMudar("complementoTampa", texto)}
        className="col-span-full"
      />
    </>
  );
}

const MESMA_INDUSTRIA: OpcaoBuscavel = { id: "", rotulo: "Mesma indústria do produto" };

/**
 * Quem fornece a tampa.
 *
 * No cadastro, marcar "variável" tira o campo: quem escolhe é o pedido. Na conta da
 * proposta o item é o próprio cadastro, e por isso o campo fica, valendo para ela.
 */
export function CampoFornecedorDaTampa({
  industrias,
  valores,
  aoMudar,
  naConta = false,
}: {
  industrias: OpcaoBuscavel[];
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
  naConta?: boolean;
}) {
  const variavel = valores.fornecedorTampaVariavel === "1";

  return (
    <>
      {(!variavel || naConta) && (
        <SelecaoBuscavel
          name="fornecedorTampaId"
          rotulo={variavel ? "Fornecedor da tampa nesta proposta" : "Fornecedor da tampa"}
          opcoes={variavel ? industrias : [MESMA_INDUSTRIA, ...industrias]}
          value={valores.fornecedorTampaId}
          aoEscolher={(id) => aoMudar("fornecedorTampaId", id)}
          placeholder="Digite para achar…"
          dica={variavel ? "Pode ficar para quando virar pedido." : "Não sai no PDF."}
        />
      )}

      {/* Montada como os campos vizinhos, para ficar na mesma régua: ver o IPI do item. */}
      <label className="block">
        <span className="rotulo block mb-1.5">Fornecedor variável</span>
        <span className="flex items-center gap-2 px-3.5 py-2.5 rounded-suave bg-folha-2 border border-transparent">
          <input
            type="checkbox"
            name="fornecedorTampaVariavel"
            value="1"
            checked={variavel}
            onChange={(e) => {
              aoMudar("fornecedorTampaVariavel", e.target.checked ? "1" : "");
              aoMudar("fornecedorTampaId", "");
            }}
            className="accent-carimbo"
          />
          <span className="text-corpo text-tinta-2">Escolher em cada pedido</span>
        </span>
      </label>
    </>
  );
}
