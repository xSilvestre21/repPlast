"use client";

import { Campo, Selecao } from "./ui";
import { CampoComplemento } from "./campo-complemento";
import { type OpcaoBuscavel, SelecaoBuscavel } from "./selecao-buscavel";
import {
  COMPLEMENTOS_TAMPA,
  MATERIAIS_TAMPA,
  type CamposDaEmbalagem,
  type TipoProduto,
  unidadeDaCapacidade,
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

/** As medidas do tipo: capacidade, as três da caixa ou o diâmetro. */
export function MedidasEmbalagem({
  tipo,
  valores,
  aoMudar,
}: {
  tipo: TipoProduto;
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  if (tipo.medida === "CAIXA") {
    return (
      <>
        <CampoMedida name="comprimentoCm" rotulo="Comprimento" sufixo="cm" placeholder="30" required valores={valores} aoMudar={aoMudar} />
        <CampoMedida name="larguraCm" rotulo="Largura" sufixo="cm" placeholder="20" required valores={valores} aoMudar={aoMudar} />
        <CampoMedida name="alturaCm" rotulo="Altura" sufixo="cm" placeholder="15" valores={valores} aoMudar={aoMudar} />
      </>
    );
  }

  if (tipo.medida === "DIAMETRO") {
    return (
      <CampoMedida
        name="diametroMm"
        rotulo={tipo.rotuloDiametro ?? "Diâmetro"}
        sufixo="mm"
        placeholder={tipo.exemploDiametro ?? "28"}
        required
        valores={valores}
        aoMudar={aoMudar}
      />
    );
  }

  const unidades = tipo.unidadesCapacidade ?? [];
  const unidade = unidadeDaCapacidade(tipo, valores.capacidadeUnidade);

  return (
    <>
      <CampoMedida
        name="capacidade"
        rotulo="Capacidade"
        sufixo={unidades.length === 1 ? unidade : undefined}
        placeholder={tipo.exemploCapacidade}
        required
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
