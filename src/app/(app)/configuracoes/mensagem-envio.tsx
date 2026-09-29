"use client";

/**
 * O assunto e a mensagem com que o e-mail do pedido abre — de quem está
 * logado, como as condições do orçamento. Quem envia é quem assina.
 *
 * Pensado para quem nunca montou modelo nenhum: os campos sugerem os dados do
 * pedido ao abrir chave, e a prévia embaixo mostra, enquanto se digita, o
 * e-mail que sairia — inclusive a linha que some quando o dado falta.
 */

import { Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { TextoComVariaveis, type VariavelSugerida } from "@/components/texto-com-variaveis";
import { Botao, MensagemErro, SecaoCartao } from "@/components/ui";
import {
  PEDIDO_EXEMPLO,
  VARIAVEIS_ENVIO,
  condicoesDoModelo,
  pedidoExemploSem,
  problemaNoModelo,
  textoPadraoDoEnvio,
} from "@/lib/envio-pedido";

import type { EstadoFormulario } from "./acoes";

const DADOS = Object.entries(VARIAVEIS_ENVIO);

/*
 * Na lista do `{`: primeiro os dados, depois os trechos condicionais — só dos
 * dados que podem faltar, porque `{se numero}` seria sempre verdade.
 */
const VARIAVEIS: VariavelSugerida[] = [
  ...DADOS.map(([nome, v]) => ({
    nome,
    rotulo: v.rotulo,
    detalhe: `ex.: ${v.exemplo}`,
    codigo: `{${nome}}`,
    abre: `{${nome}}`,
    grupo: "Dados do pedido",
  })),
  ...DADOS.filter(([, v]) => v.podeFaltar).map(([nome, v]) => ({
    nome: `se ${nome}`,
    rotulo: `Só se tiver: ${v.rotulo}`,
    detalhe: "escreva entre as duas marcas",
    codigo: `{se ${nome}}…{fim}`,
    abre: `{se ${nome}}`,
    fecha: "{fim}",
    grupo: "Trecho condicional",
  })),
];

export function FormMensagemEnvio({
  assunto: assuntoSalvo,
  mensagem: mensagemSalva,
  salvar,
}: {
  assunto: string;
  mensagem: string;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [assunto, setAssunto] = useState(assuntoSalvo);
  const [mensagem, setMensagem] = useState(mensagemSalva);

  const [completo, setCompleto] = useState(true);

  const problema = problemaNoModelo(assunto) ?? problemaNoModelo(mensagem);

  /*
   * O segundo exemplo tira SÓ os dados que o texto usa em "Só se tiver…" — é
   * para ver o trecho condicional sumir, e nada mais mudar. Sem condição no
   * texto, não há o que comparar e a escolha nem aparece.
   */
  const condicoes = condicoesDoModelo(`${assunto}\n${mensagem}`);
  const semCondicoes = !completo && condicoes.length > 0;
  const previa = textoPadraoDoEnvio(
    semCondicoes ? pedidoExemploSem(condicoes) : PEDIDO_EXEMPLO,
    { assunto, corpo: mensagem },
  );
  const rotuloSem = `Sem ${condicoes
    .map((nome) => VARIAVEIS_ENVIO[nome].rotulo)
    .join(", ")
    .replace(/, ([^,]*)$/, " e $1")}`;

  return (
    <SecaoCartao
      icone={Mail}
      titulo="Mensagem padrão do e-mail"
      descricao="Entra preenchida quando você envia um pedido para a indústria. Dá para editar em cada envio, sem afetar este padrão."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <p className="text-corpo text-tinta-2">
          Digite{" "}
          <kbd className="rounded-miudo border border-filete px-1.5 text-tinta">{"{"}</kbd> para
          colocar um dado do pedido — número, cliente, CNPJ… Ele muda sozinho em cada envio.
          Na mesma lista, <span className="text-tinta">“Só se tiver…”</span> cria um trecho que
          só aparece quando o pedido tem aquele dado.
        </p>

        <TextoComVariaveis
          name="assuntoEnvioPadrao"
          rotulo="Assunto"
          variaveis={VARIAVEIS}
          valor={assunto}
          aoMudar={setAssunto}
        />

        <TextoComVariaveis
          name="mensagemEnvioPadrao"
          rotulo="Mensagem"
          variaveis={VARIAVEIS}
          valor={mensagem}
          aoMudar={setMensagem}
          linhas={8}
        />

        {problema && <p className="text-mini text-perigo">{problema}</p>}

        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <span className="rotulo text-tinta-2">Como fica, num pedido de exemplo</span>
            {condicoes.length > 0 && (
              <div className="flex gap-1 text-mini" role="group" aria-label="Pedido de exemplo">
                {[
                  { valor: true, rotulo: "Com todos os dados" },
                  { valor: false, rotulo: rotuloSem },
                ].map((opcao) => (
                  <button
                    key={String(opcao.valor)}
                    type="button"
                    aria-pressed={!semCondicoes === opcao.valor}
                    onClick={() => setCompleto(opcao.valor)}
                    className={`rounded-miudo px-2 py-1 transition-colors ${
                      !semCondicoes === opcao.valor
                        ? "bg-folha-2 text-tinta"
                        : "text-tinta-3 hover:text-tinta"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-suave border border-filete px-3.5 py-3 text-corpo">
            <div className="font-semibold text-tinta">{previa.assunto}</div>
            <div className="mt-2 whitespace-pre-wrap text-tinta-2">{previa.corpo}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-mini text-tinta-3">Apagar tudo volta ao texto original.</span>
          <Botao type="submit" variante="secundaria" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar mensagem"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
