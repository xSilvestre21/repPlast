"use client";

/**
 * "Enviado", entregue por um avião de papel — o do pedido e o da proposta.
 *
 * Mandar um documento é o momento que fecha a venda para quem representa — e
 * o aviso ficava num canto da página, pequeno como um rodapé. Aqui ele vira um
 * acontecimento curto: a tela escurece sem sumir (dá para ver o pedido por
 * trás), o avião de papel — o mesmo ícone do botão de enviar — cruza em arco,
 * e no meio do caminho deixa o cartão no centro dizendo para quem foi.
 *
 * Some sozinho em ~3 s, ou antes com um clique ou Esc. Quando o servidor
 * recusou parte dos endereços NÃO some: espera um "Entendi", porque esse aviso
 * não pode passar despercebido.
 *
 * O voo é todo CSS (`.entrega-*` em `globals.css`). A trajetória é calculada
 * aqui, em pixels da janela, porque o avião (`offset-path`) e o rastro (SVG)
 * precisam seguir exatamente o mesmo caminho. Com as animações desligadas na
 * conta, o avião nem aparece e o cartão já nasce no lugar.
 */

import { CircleCheck, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Botao } from "@/components/ui";

/** Quanto o cartão fica na tela depois de pousar, antes de sumir sozinho. */
const TEMPO_NA_TELA_MS = 3600;
/** A saída: o esmaecer do fundo e do cartão, antes de desmontar. */
const SAIDA_MS = 250;

/**
 * O arco do voo: entra por baixo à esquerda, mergulha pelo centro (onde o
 * cartão pousa) e sai por cima à direita.
 */
function trajetoria(largura: number, altura: number): string {
  const x = (fracao: number) => Math.round(largura * fracao);
  const y = (fracao: number) => Math.round(altura * fracao);
  return (
    `M ${x(-0.06)} ${y(0.92)} ` +
    `C ${x(0.18)} ${y(0.4)}, ${x(0.38)} ${y(0.28)}, ${x(0.5)} ${y(0.5)} ` +
    `C ${x(0.6)} ${y(0.7)}, ${x(0.76)} ${y(0.22)}, ${x(1.08)} ${y(-0.08)}`
  );
}

export function EntregaEnviado({
  titulo,
  para,
  cc,
  aviso,
  fechar,
}: {
  /** "Pedido enviado para a QUALYPLAST", "Proposta enviada para a AKILAH". */
  titulo: string;
  para: string[];
  cc: string[];
  aviso?: string;
  fechar: () => void;
}) {
  // Só monta depois de um envio, no navegador: a janela já existe.
  const [janela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  const [saindo, setSaindo] = useState(false);
  const saida = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sair = useCallback(() => {
    if (saida.current) return;
    setSaindo(true);
    saida.current = setTimeout(fechar, SAIDA_MS);
  }, [fechar]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") sair();
    };
    window.addEventListener("keydown", aoTeclar);

    // Com recusa, a pessoa precisa ler — nada de sumir sozinho.
    const cronometro = aviso ? undefined : setTimeout(sair, TEMPO_NA_TELA_MS);

    return () => {
      window.removeEventListener("keydown", aoTeclar);
      clearTimeout(cronometro);
    };
  }, [aviso, sair]);

  useEffect(() => () => clearTimeout(saida.current), []);

  const caminho = trajetoria(janela.largura, janela.altura);

  return createPortal(
    <div
      className={`entrega fixed inset-0 z-[60] grid place-items-center p-4 ${saindo ? "entrega-saindo" : ""}`}
      onClick={sair}
    >
      <div className="entrega-fundo absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      <svg
        aria-hidden="true"
        className="entrega-rastro pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${janela.largura} ${janela.altura}`}
      >
        <path d={caminho} pathLength={1} fill="none" />
      </svg>

      <div
        role={aviso ? "alertdialog" : "status"}
        aria-live={aviso ? undefined : "polite"}
        aria-label={aviso ? `${titulo}, com recusas` : undefined}
        onClick={(evento) => evento.stopPropagation()}
        className="entrega-cartao relative w-full max-w-[26rem] rounded-suave border border-filete bg-folha p-5
          text-center shadow-[var(--sombra-alta)]"
      >
        <CircleCheck
          size={36}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mx-auto mb-3 text-verde"
        />
        <p className="text-realce font-semibold text-tinta">{titulo}</p>
        <p className="mt-1.5 break-words text-corpo text-tinta-2">
          Para {para.join(", ")}
          {cc.length > 0 && ` · cópia para ${cc.join(", ")}`}
        </p>

        {aviso && (
          <>
            <p className="mt-3 rounded-suave bg-perigo-fraco px-3 py-2 text-corpo text-perigo">
              {aviso}
            </p>
            <div className="mt-4 flex justify-center">
              <Botao type="button" autoFocus onClick={sair}>
                Entendi
              </Botao>
            </div>
          </>
        )}
      </div>

      {/*
        Depois do cartão no DOM, para passar POR CIMA dele — é quem entrega.
        Preenchido com a cor do papel e contornado de azul: um avião de papel
        de verdade, e não um traço fino que some contra o fundo escurecido.
      */}
      <span
        aria-hidden="true"
        className="entrega-aviao pointer-events-none absolute left-0 top-0 text-carimbo"
        style={{ offsetPath: `path("${caminho}")` }}
      >
        {/* O ícone aponta para o nordeste; girado, aponta para onde o caminho vai. */}
        <Send
          size={46}
          strokeWidth={1.6}
          fill="var(--folha)"
          className="rotate-45 drop-shadow-[0_6px_10px_rgb(0_0_0/0.3)]"
        />
      </span>
    </div>,
    document.body,
  );
}
