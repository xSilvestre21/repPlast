"use client";

/**
 * A caixa onde se cola a assinatura do Gmail ou do Outlook.
 *
 * O sistema só envia pela senha de app — não tem como LER a assinatura que a
 * pessoa configurou lá. Então ela copia a própria assinatura da página do
 * Gmail e cola aqui; a caixa é editável e guarda a formatação da cópia (logo,
 * cores, links), e o HTML dela segue no formulário pelo campo `assinatura`.
 *
 * A limpeza que vale é a do servidor (`limparAssinatura`); a daqui só tira, já
 * na colagem, o que nem deveria entrar na página: script, `on…` e
 * `javascript:`.
 */

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ClipboardEvent } from "react";

import { CLASSE_CONTROLE, CLASSE_ERRO } from "@/components/controle";
import { PreviaAssinatura } from "@/components/previa-assinatura";
import { BotaoTexto, RodapeCampo, Rotulo } from "@/components/ui";
import type { Provedor } from "@/lib/provedores-email";

/**
 * Onde achar a assinatura para copiar, com os nomes que aparecem nas telas do
 * serviço. Hostinger, Locaweb e o domínio próprio caem no webmail genérico.
 */
const PASSOS_GMAIL = [
  "No Gmail, no computador, clique na engrenagem (canto de cima, à direita) e em “Ver todas as configurações”.",
  "Na aba “Geral”, desça até “Assinatura” e clique no nome da sua assinatura.",
  "Clique dentro do texto dela, aperte Ctrl+A para selecionar tudo e Ctrl+C para copiar (no Mac, Cmd+A e Cmd+C).",
  "Volte aqui, clique na caixa abaixo e aperte Ctrl+V. O logo, as cores e os links vêm junto.",
];

const PASSOS_OUTLOOK = [
  "No Outlook da web, clique na engrenagem (canto de cima, à direita) e vá em “Contas” → “Assinaturas”. " +
    "No Outlook instalado: Arquivo → Opções → Email → Assinaturas.",
  "Escolha a sua assinatura, clique dentro do texto dela, aperte Ctrl+A e depois Ctrl+C.",
  "Volte aqui, clique na caixa abaixo e aperte Ctrl+V. Se o logo não vier, use “Adicionar imagem” com o arquivo dele.",
];

const PASSOS_WEBMAIL = [
  "Abra o seu webmail e procure “Assinatura” nas configurações.",
  "Clique dentro do texto da assinatura, aperte Ctrl+A e depois Ctrl+C.",
  "Volte aqui, clique na caixa abaixo e aperte Ctrl+V.",
];

const PASSOS: Record<Provedor, { de: string; passos: string[] }> = {
  GMAIL: { de: "do Gmail", passos: PASSOS_GMAIL },
  OUTLOOK: { de: "do Outlook", passos: PASSOS_OUTLOOK },
  HOSTINGER: { de: "do webmail", passos: PASSOS_WEBMAIL },
  LOCAWEB: { de: "do webmail", passos: PASSOS_WEBMAIL },
  OUTRO: { de: "do webmail", passos: PASSOS_WEBMAIL },
};

/** Logo maior que isso pesa em todo e-mail que sai. */
const LIMITE_IMAGEM = 200 * 1024;

const PERIGOSAS = "script, style, iframe, object, embed, link, meta, form, input, button";

/** Tira da colagem o que roda código, antes de ela entrar na página. */
function limparColagem(html: string): string {
  const documento = new DOMParser().parseFromString(html, "text/html");
  documento.querySelectorAll(PERIGOSAS).forEach((elemento) => elemento.remove());
  documento.querySelectorAll("*").forEach((elemento) => {
    for (const atributo of [...elemento.attributes]) {
      const valor = atributo.value.trim().toLowerCase();
      if (atributo.name.startsWith("on") || valor.startsWith("javascript:")) {
        elemento.removeAttribute(atributo.name);
      }
    }
  });
  return documento.body.innerHTML;
}

/**
 * Imagem que não vai chegar: o Outlook às vezes cola o logo como um endereço
 * que só existe no computador de quem copiou (`blob:`, `file:`, `cid:`).
 */
function temImagemPerdida(html: string): boolean {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)].some(
    ([, src]) => !/^(https:|data:image\/(png|jpe?g|gif);)/i.test(src),
  );
}

function inserirNoCursor(caixa: HTMLElement, html: string) {
  const selecao = window.getSelection();
  const intervalo = selecao?.rangeCount ? selecao.getRangeAt(0) : null;

  if (!intervalo || !caixa.contains(intervalo.commonAncestorContainer)) {
    caixa.insertAdjacentHTML("beforeend", html);
    return;
  }
  intervalo.deleteContents();
  const fragmento = intervalo.createContextualFragment(html);
  const ultimo = fragmento.lastChild;
  intervalo.insertNode(fragmento);
  if (ultimo) {
    intervalo.setStartAfter(ultimo);
    intervalo.collapse(true);
    selecao!.removeAllRanges();
    selecao!.addRange(intervalo);
  }
}

export function CampoAssinatura({
  inicial,
  erro,
  provedor = "GMAIL",
}: {
  inicial: string;
  erro?: string;
  provedor?: Provedor;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(inicial);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const idRodape = useId();

  // O conteúdo inicial entra uma vez; daí em diante a caixa é da pessoa, e o
  // React não a reescreve a cada tecla (o cursor pularia para o começo).
  useEffect(() => {
    if (caixa.current) caixa.current.innerHTML = inicial;
  }, [inicial]);

  const atualizar = () => setHtml(caixa.current?.innerHTML ?? "");

  function colar(evento: ClipboardEvent<HTMLDivElement>) {
    const colado = evento.clipboardData.getData("text/html");
    if (!colado) return; // texto puro: o navegador cola sozinho, sem formatação
    evento.preventDefault();
    inserirNoCursor(evento.currentTarget, limparColagem(colado));
    atualizar();
  }

  function adicionarImagem(escolhido: File | undefined) {
    if (!escolhido) return;
    if (!/^image\/(png|jpeg|gif)$/.test(escolhido.type)) {
      setErroImagem("Use uma imagem PNG, JPG ou GIF — é o que todo leitor de e-mail mostra.");
      return;
    }
    if (escolhido.size > LIMITE_IMAGEM) {
      setErroImagem(
        "Esta imagem é grande demais para ir em todo e-mail. Use uma de até 200 KB — o logo " +
          "em tamanho de assinatura costuma ter bem menos.",
      );
      return;
    }
    setErroImagem(null);
    const leitor = new FileReader();
    leitor.onload = () => {
      if (!caixa.current) return;
      inserirNoCursor(caixa.current, `<img src="${leitor.result}" alt="" style="max-width:240px">`);
      atualizar();
    };
    leitor.readAsDataURL(escolhido);
  }

  function remover() {
    if (caixa.current) caixa.current.innerHTML = "";
    setHtml("");
  }

  // Um rodapé só, como em todo campo: o erro do momento ganha da dica.
  const aviso =
    erroImagem ??
    erro ??
    (temImagemPerdida(html)
      ? "A imagem da sua assinatura não veio na cópia — ela não chegaria a quem recebe. " +
        "Apague o espaço dela e use “Adicionar imagem” com o arquivo do logo."
      : undefined);

  const guia = PASSOS[provedor];

  return (
    <div>
      <Rotulo>Assinatura</Rotulo>

      {/* Aberto enquanto não há assinatura: é quando a pessoa precisa dele. */}
      <details open={inicial.trim() === ""} className="mb-2 text-mini text-tinta-2 leading-relaxed">
        <summary className="text-tinta-3 cursor-pointer select-none">
          Como copiar a assinatura {guia.de}
        </summary>
        <ol className="list-decimal pl-5 space-y-0.5 mt-1.5">
          {guia.passos.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
        <p className="mt-1.5">Ainda não tem uma? Escreva direto na caixa e use “Adicionar imagem” para o logo.</p>
      </details>

      {/*
        As cores da assinatura são feitas para o fundo branco do e-mail; no
        tema escuro, o texto escuro dela sumiria na caixa. Aqui o texto fica na
        cor da tela — as cores continuam no HTML, e a prévia abaixo as mostra.
      */}
      <div
        ref={caixa}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Assinatura"
        aria-invalid={aviso ? true : undefined}
        aria-describedby={idRodape}
        data-placeholder="Clique aqui e cole a sua assinatura (Ctrl+V)"
        onPaste={colar}
        onInput={atualizar}
        className={`${CLASSE_CONTROLE} min-h-24 max-h-72 overflow-auto
          [&_*]:text-inherit! [&_*]:bg-transparent!
          empty:before:content-[attr(data-placeholder)] empty:before:text-tinta-3
          ${aviso ? CLASSE_ERRO : ""}`}
      />
      <input type="hidden" name="assinatura" value={html} />
      <RodapeCampo
        id={idRodape}
        erro={aviso}
        dica="Vai no fim de todo e-mail de pedido e de proposta."
      />

      {html.trim() !== "" && (
        <div className="mt-3">
          <span className="block text-mini text-tinta-3 mb-1.5">Como vai sair no e-mail</span>
          <PreviaAssinatura html={html} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-2">
        <BotaoTexto
          type="button"
          onClick={() => arquivo.current?.click()}
          className="inline-flex items-center gap-1"
        >
          <ImagePlus size={12} aria-hidden="true" />
          Adicionar imagem
        </BotaoTexto>
        <input
          ref={arquivo}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          className="hidden"
          aria-label="Imagem da assinatura"
          onChange={(e) => {
            adicionarImagem(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        {html.trim() !== "" && (
          <BotaoTexto type="button" onClick={remover} perigoso className="inline-flex items-center gap-1">
            <Trash2 size={12} aria-hidden="true" />
            Remover assinatura
          </BotaoTexto>
        )}
      </div>
    </div>
  );
}
