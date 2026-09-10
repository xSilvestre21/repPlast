"use client";

import { useActionState } from "react";

import { AreaTexto, Botao, Campo, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export type ValoresCliente = {
  apelido: string;
  razaoSocial: string;
  cnpj: string;
  ie: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  emailNfe: string;
  observacoes: string;
};

export const VALORES_VAZIOS: ValoresCliente = {
  apelido: "",
  razaoSocial: "",
  cnpj: "",
  ie: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  telefone: "",
  email: "",
  emailNfe: "",
  observacoes: "",
};

export function FormularioCliente({
  acao,
  valores,
  rotuloEnvio,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valores: ValoresCliente;
  rotuloEnvio: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao
        titulo="Identificação"
        descricao="A razão social, o CNPJ e a IE saem impressos no cabeçalho do pedido."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            name="apelido"
            rotulo="Nome curto"
            required
            dica="Usado nas listas e no nome do arquivo PDF."
            placeholder="MARIOL"
            defaultValue={valores.apelido}
          />
          <Campo
            name="razaoSocial"
            rotulo="Razão social"
            required
            placeholder="MARIOL EMBALAGENS LTDA"
            defaultValue={valores.razaoSocial}
          />
          <Campo
            name="cnpj"
            rotulo="CNPJ"
            inputMode="numeric"
            dica="Pode digitar só os números."
            placeholder="09.507.378/0001-50"
            defaultValue={valores.cnpj}
          />
          <Campo
            name="ie"
            rotulo="Inscrição estadual"
            defaultValue={valores.ie}
            placeholder="204.222.524.111"
          />
        </div>
      </SecaoCartao>

      <SecaoCartao titulo="Endereço">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            name="endereco"
            rotulo="Logradouro e número"
            className="sm:col-span-2 lg:col-span-3"
            defaultValue={valores.endereco}
          />
          <Campo
            name="cep"
            rotulo="CEP"
            inputMode="numeric"
            defaultValue={valores.cep}
            placeholder="14781-160"
          />
          <Campo
            name="bairro"
            rotulo="Bairro"
            className="sm:col-span-2"
            defaultValue={valores.bairro}
          />
          <Campo name="municipio" rotulo="Município" defaultValue={valores.municipio} />
          <Campo
            name="uf"
            rotulo="UF"
            maxLength={2}
            defaultValue={valores.uf}
            placeholder="SP"
          />
        </div>
      </SecaoCartao>

      <SecaoCartao titulo="Contato">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo name="telefone" rotulo="Telefone" defaultValue={valores.telefone} />
          <Campo name="email" rotulo="E-mail" type="email" defaultValue={valores.email} />
          <Campo
            name="emailNfe"
            rotulo="E-mail para a NF-e"
            type="email"
            dica="Sai impresso no pedido."
            defaultValue={valores.emailNfe}
          />
        </div>
      </SecaoCartao>

      <SecaoCartao
        titulo="Observações"
        descricao="Recados que costumam se repetir nos pedidos deste cliente — horário de recebimento, exigências de entrega."
      >
        <label className="block">
          <span className="sr-only">Observações</span>
          <AreaTexto
            name="observacoes"
            rows={4}
            defaultValue={valores.observacoes}
            placeholder="Recebimento de 2ª a 5ª das 8:00 às 12:00…"
          />
        </label>
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
