"use client";

import { useContext, useEffect, useRef, useState, type ComponentProps, type FormEvent, type InputEvent } from "react";

import { erroDoCampo, type EstadoFormulario } from "@/lib/erro-formulario";

import { ContextoFormulario, type Contexto } from "./contexto-formulario";

export { useCampoDoFormulario } from "./contexto-formulario";
import { MensagemErro } from "./ui";

/*
 * O formulário que mostra cada erro embaixo do campo que o causou.
 *
 * Antes, todo erro virava um alerta no topo — e o campo errado podia estar a
 * uma rolagem inteira dali, no pé da ficha, perto do botão que a pessoa tinha
 * acabado de clicar. Ela clicava em Salvar e "nada acontecia".
 *
 * Aqui o formulário distribui os erros por `name`: cada `Campo`, `Selecao`,
 * `AreaTexto` (e os controles próprios, por `useCampoDoFormulario`) pega o
 * seu. A tela não precisa passar `erro=` campo a campo.
 *
 * Os erros vêm de dois lugares, e a pessoa não deveria notar a diferença:
 *
 *   - do servidor, no estado da ação (`campo` + `erro`);
 *   - do próprio navegador, antes do envio — campo obrigatório, e-mail sem @.
 *     O balão nativo é cancelado: ele segue o idioma do Chrome, não o da
 *     tela, e some sozinho em três segundos.
 */

/** Rola até o controle e põe o cursor nele, como o navegador faz no `required`. */
function levarAte(alvo: HTMLElement) {
  const semMovimento = document.documentElement.dataset.animacoes === "desativadas";
  alvo.scrollIntoView({ block: "center", behavior: semMovimento ? "auto" : "smooth" });
  alvo.focus({ preventScroll: true });
}

type Controle = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * De qual campo é o controle. `data-campo` vem primeiro: é por ele que a
 * linha de tabela se distingue (`email#1`, quando todas se chamam `email`) e
 * que a seleção com busca, cujo valor vai num input escondido, diz o seu nome.
 */
function nomeDe(controle: Controle): string | undefined {
  return controle.dataset?.campo || controle.name || undefined;
}

/** O rótulo como a pessoa o lê na tela, para a frase dizer de qual campo é. */
function rotuloDe(controle: Controle): string {
  const doRotulo = controle.closest("label")?.querySelector(".rotulo")?.textContent;
  return (doRotulo ?? controle.getAttribute("aria-label") ?? "").trim();
}

/**
 * A frase para o que o navegador recusou — em português e dizendo o que fazer,
 * em vez do "Please fill out this field." de um Chrome em inglês.
 */
function mensagemDoNavegador(controle: Controle): string {
  const validade = controle.validity;
  const rotulo = rotuloDe(controle);
  const nomeado = rotulo ? `“${rotulo}”` : "este campo";

  if (validade.customError) return controle.validationMessage;

  if (validade.valueMissing) {
    if (controle instanceof HTMLSelectElement) return `Escolha uma opção em ${nomeado}.`;
    if (controle.type === "checkbox") return "Marque esta opção para continuar.";
    if (controle.type === "file") return "Escolha um arquivo antes de enviar.";
    return `Preencha ${nomeado} — este campo é obrigatório.`;
  }

  if (validade.typeMismatch && controle.type === "email") {
    return "Este e-mail parece incompleto. Confira se tem o @ e o final, como nome@empresa.com.br.";
  }

  const tamanho = controle.value.length;
  if (validade.tooShort && "minLength" in controle) {
    return `Use pelo menos ${controle.minLength} caracteres — agora são ${tamanho}.`;
  }
  if (validade.tooLong && "maxLength" in controle) {
    return `Use no máximo ${controle.maxLength} caracteres — agora são ${tamanho}.`;
  }

  if ("min" in controle && validade.rangeUnderflow) return `O menor valor aceito é ${controle.min}.`;
  if ("max" in controle && validade.rangeOverflow) return `O maior valor aceito é ${controle.max}.`;

  if (validade.badInput) return "Este valor está incompleto. Confira e termine de preencher.";

  return `Confira ${nomeado}: o que foi digitado não está no formato certo.`;
}

export function Formulario({
  estado,
  children,
  onInvalidCapture,
  onInputCapture,
  ...props
}: ComponentProps<"form"> & { estado?: EstadoFormulario }) {
  const formulario = useRef<HTMLFormElement>(null);
  const focoPendente = useRef(false);

  /** Erros que o navegador achou antes do envio. */
  const [doNavegador, setDoNavegador] = useState<Record<string, string>>({});
  /** Campos mexidos depois do erro: o erro deles some na hora. */
  const [corrigidos, setCorrigidos] = useState<ReadonlySet<string>>(new Set());
  /** O servidor apontou um campo que esta tela não tem — vira erro geral. */
  const [semCampoNaTela, setSemCampoNaTela] = useState(false);

  // Resposta nova do servidor: começa tudo de novo a partir dela. Ajuste de
  // estado na renderização, e não num efeito, para não pintar um quadro com o
  // erro velho.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    setDoNavegador({});
    setCorrigidos(new Set());
    setSemCampoNaTela(false);
  }

  // Depois que a resposta pinta, leva a pessoa até o erro.
  useEffect(() => {
    const raiz = formulario.current;
    if (!estado?.erro || !raiz) return;

    if (estado.campo) {
      const alvo = raiz.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido]');
      if (alvo) {
        levarAte(alvo);
        return;
      }
      // Sem o campo na tela, a frase ficaria invisível. Mostra no lugar do
      // erro geral, que é o que há de mais perto do botão.
      setSemCampoNaTela(true);
      return;
    }

    const geral = raiz.querySelector<HTMLElement>("[data-erro-geral]");
    geral?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [estado]);

  useEffect(() => {
    if (!semCampoNaTela) return;
    formulario.current
      ?.querySelector<HTMLElement>("[data-erro-geral]")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [semCampoNaTela]);

  function aoRecusar(evento: FormEvent<HTMLFormElement>) {
    onInvalidCapture?.(evento);

    const controle = evento.target as Controle;
    const nome = nomeDe(controle);
    // Controle sem nome não tem onde mostrar a frase: fica o balão do navegador.
    if (!nome) return;

    evento.preventDefault();
    const mensagem = mensagemDoNavegador(controle);
    setDoNavegador((atuais) => (atuais[nome] === mensagem ? atuais : { ...atuais, [nome]: mensagem }));
    setCorrigidos((atuais) => {
      if (!atuais.has(nome)) return atuais;
      const proximos = new Set(atuais);
      proximos.delete(nome);
      return proximos;
    });

    // O navegador avisa um `invalid` por campo, em ordem: o cursor vai para o
    // primeiro, como no balão nativo.
    if (!focoPendente.current) {
      focoPendente.current = true;
      requestAnimationFrame(() => {
        focoPendente.current = false;
        levarAte(controle);
      });
    }
  }

  function aoDigitar(evento: InputEvent<HTMLFormElement>) {
    onInputCapture?.(evento);

    const nome = nomeDe(evento.target as Controle);
    if (!nome || corrigidos.has(nome)) return;
    if (!doNavegador[nome] && estado?.campo !== nome) return;

    setCorrigidos((atuais) => new Set(atuais).add(nome));
  }

  const contexto: Contexto = {
    erroDe: (nome) => {
      if (!nome || corrigidos.has(nome)) return undefined;
      return doNavegador[nome] ?? erroDoCampo(estado, nome);
    },
    valorDe: (nome) => (nome && estado?.erro ? estado.valores?.[nome] : undefined),
    erroGeral:
      estado?.erro && (!estado.campo || semCampoNaTela) ? estado.erro : undefined,
  };

  return (
    <ContextoFormulario.Provider value={contexto}>
      <form
        ref={formulario}
        onInvalidCapture={aoRecusar}
        onInputCapture={aoDigitar}
        {...props}
      >
        {children}
      </form>
    </ContextoFormulario.Provider>
  );
}

/**
 * O erro que não é de campo nenhum — sessão vencida, cadastro apagado em outra
 * aba. Vai logo ACIMA do botão de enviar: é para lá que a pessoa está olhando
 * quando clica.
 */
export function ErroGeral() {
  const contexto = useContext(ContextoFormulario);
  if (!contexto?.erroGeral) return null;

  return (
    <div data-erro-geral>
      <MensagemErro>{contexto.erroGeral}</MensagemErro>
    </div>
  );
}
