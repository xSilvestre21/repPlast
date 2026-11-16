"use client";

/**
 * "Pagamento realizado com sucesso" — o saco de dinheiro vai para a caçamba, o
 * caminhão leva até a casa do preposto e o saco entra pela porta.
 *
 * Era um "✓ Pagamento registrado" miúdo na linha do preposto, que dizia pouco
 * e passava despercebido. Aqui o pagamento vira um acontecimento curto, como o
 * avião do "pedido enviado" (`components/entrega-enviado.tsx`), de quem esta
 * janela empresta a moldura: a tela escurece sem sumir, o saco e as moedas
 * caem na caçamba, o caminhão anda até a casa com o nome de quem recebe, o
 * saco pula para dentro e o selo de confirmado aparece sobre o telhado. O que
 * importa — quanto foi pago, quando, e se ficou quitado ou quanto ainda falta —
 * sobe enquanto o caminhão anda, para a pessoa já ir lendo.
 *
 * NÃO some sozinho: espera o "Ok" (ou Esc, ou um clique fora). Ele diz se o
 * preposto ainda tem a receber, e isso não pode passar antes de ser lido.
 *
 * O movimento é do Motion (`useAnimate`), numa linha do tempo só — escolhido
 * consultando a documentação dele (motion.dev). Tudo o que se move anima só
 * `transform` e `opacity`, que o Motion entrega à Web Animations API e o
 * navegador anima no compositor, sem a thread principal: quando o pagamento
 * volta do servidor, o React está recarregando a tela por baixo, e um voo
 * feito em JavaScript travaria justo ali. Pelo mesmo motivo cada peça que se
 * move é um elemento HTML com o seu desenho dentro (`desenho-do-pagamento.tsx`),
 * e não um `<g>` de um SVG só — o `transform` de um `<g>` nem sempre vai para o
 * compositor.
 *
 * Com as animações desligadas na conta (`data-animacoes`), nada se move: a
 * cena nasce pronta, com o caminhão parado na frente da casa e o selo nela.
 */

import { CircleCheck } from "lucide-react";
import { stagger, useAnimate } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { focarSePuder } from "@/components/foco";
import { Botao, formatarMoeda } from "@/components/ui";

import {
  ALTURA,
  CAMINHAO,
  CASA,
  CHAO,
  Casa,
  LARGURA,
  LateralDaCacamba,
  Moeda,
  Nuvem,
  PULO_DO_SACO,
  Roda,
  SACO,
  SacoDeDinheiro,
  TraseiraDoCaminhao,
} from "./desenho-do-pagamento";
import { fraseDoSaldo } from "./frase-do-pagamento";

/** A saída: o esmaecer do fundo e do cartão, antes de desmontar. */
const SAIDA_MS = 250;
/** Quando o caminhão arranca, em segundos — depois do saco e das moedas pousarem. */
const PARTIDA = 1.45;
/** A viagem até a casa. */
const VIAGEM = 1.3;
/** Quando o saco pula para a porta: o caminhão acabou de parar. */
const ENTREGA = PARTIDA + VIAGEM + 0.05;

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export type ResumoDoPagamento = {
  valor: number;
  /** "AAAA-MM-DD". */
  data: string;
  observacao: string;
  /** O que falta pagar depois deste pagamento; negativo quando passou. */
  restante: number;
};

const CORES_DA_SITUACAO = {
  quitado: "text-verde bg-verde-fraco",
  faltando: "text-perigo bg-perigo-fraco",
  "a-mais": "text-carimbo bg-carimbo-fraco",
} as const;

/** As moedas na caçamba: onde cada uma para, dentro da caixa do caminhão. */
const MOEDAS = [
  { esquerda: 76, topo: 31 },
  { esquerda: 91, topo: 31 },
  { esquerda: 84, topo: 21 },
];

export function PagamentoRealizado({
  resumo,
  nome,
  mes,
  fechar,
}: {
  resumo: ResumoDoPagamento;
  /** O primeiro nome do preposto — vai na placa da casa e no texto. */
  nome: string;
  /** "novembro de 2026". */
  mes: string;
  fechar: () => void;
}) {
  // Montado só depois de um pagamento, no navegador: o atributo já está lá.
  const [animar] = useState(() => document.documentElement.dataset.animacoes !== "desativadas");
  const [saindo, setSaindo] = useState(false);
  const saida = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [cartao, animate] = useAnimate<HTMLDivElement>();
  const ok = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();

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
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [sair]);

  useEffect(() => () => clearTimeout(saida.current), []);

  // O "Ok" com o foco, para o Enter dispensar — só no teclado (`foco.ts`).
  useEffect(() => {
    focarSePuder(ok.current);
  }, []);

  /*
   * A linha do tempo, com os instantes escritos por extenso (`at` em segundos):
   * um passo depende do outro — o caminhão só arranca depois do saco e das
   * moedas pousarem, o saco só pula quando ele para —, e com os números à
   * vista dá para acertar o ritmo sem adivinhar o que "<" e "+" somam.
   */
  useEffect(() => {
    if (!animar || !cartao.current) return;
    const anda = CAMINHAO.anda;
    const { x, y } = PULO_DO_SACO;

    const controles = animate([
      // O cartão chega.
      [cartao.current, { opacity: [0, 1], transform: ["scale(0.96)", "scale(1)"] }, { duration: 0.25, ease: "easeOut", at: 0 }],
      // O saco cai na caçamba, acelerando…
      [
        "[data-saco]",
        { opacity: [0, 1, 1], transform: ["translateY(-110px)", "translateY(-70px)", "translateY(0px)"] },
        { duration: 0.5, ease: "easeIn", at: 0.1 },
      ],
      // …amassa ao pousar…
      [
        "[data-saco]",
        { transform: ["translateY(0px) scale(1.1, 0.86)", "translateY(0px) scale(1, 1)"] },
        { duration: 0.22, ease: "easeOut", at: 0.6 },
      ],
      // …e o caminhão abaixa com o peso, como a suspensão.
      ["[data-carroceria]", { transform: ["translateY(4px)", "translateY(0px)"] }, { duration: 0.28, ease: "easeOut", at: 0.6 }],
      // As moedas caem atrás, uma depois da outra, e quicam.
      [
        "[data-moeda]",
        {
          opacity: [0, 1, 1, 1],
          transform: ["translateY(-90px)", "translateY(0px)", "translateY(-9px)", "translateY(0px)"],
        },
        { duration: 0.5, times: [0, 0.6, 0.8, 1], ease: ["easeIn", "easeOut", "easeIn"], at: 0.72, delay: stagger(0.1) },
      ],
      // A viagem: o caminhão arranca devagar, freia e balança ao parar…
      [
        "[data-caminhao]",
        { transform: ["translateX(0px)", `translateX(${anda + 7}px)`, `translateX(${anda}px)`] },
        { duration: VIAGEM, times: [0, 0.86, 1], ease: ["easeInOut", "easeOut"], at: PARTIDA },
      ],
      // …com as rodas girando (o quanto um pneu gira para andar isso)…
      [
        "[data-roda]",
        { transform: ["rotate(0deg)", `rotate(${Math.round((anda / (Math.PI * 30)) * 360)}deg)`] },
        { duration: VIAGEM, ease: "easeInOut", at: PARTIDA },
      ],
      // …os riscos de velocidade e a poeira de onde ele saiu.
      ["[data-velocidade]", { opacity: [0, 1, 0] }, { duration: 1.1, at: PARTIDA }],
      [
        "[data-poeira]",
        { opacity: [0, 0.75, 0], transform: ["translateX(0px) scale(0.5)", "translateX(-26px) scale(1.5)"] },
        { duration: 0.7, ease: "easeOut", at: PARTIDA, delay: stagger(0.09) },
      ],
      // O que importa sobe enquanto ele anda: dá para ir lendo.
      ["[data-texto]", { opacity: [0, 1], transform: ["translateY(10px)", "translateY(0px)"] }, { duration: 0.4, ease: "easeOut", at: PARTIDA + 0.35 }],
      // Parado na frente da casa, o saco pula da caçamba para a porta e entra.
      [
        "[data-saco]",
        {
          opacity: [1, 1, 0],
          transform: [
            "translate(0px, 0px) scale(1)",
            `translate(${x / 2}px, -48px) scale(0.95)`,
            `translate(${x}px, ${y}px) scale(0.3)`,
          ],
        },
        { duration: 0.6, times: [0, 0.5, 1], ease: ["easeOut", "easeIn"], at: ENTREGA },
      ],
      // A casa recebe: um pulinho…
      [
        "[data-casa]",
        { transform: ["scale(1)", "scale(1.06, 0.96)", "scale(1)"] },
        { duration: 0.35, ease: "easeOut", at: ENTREGA + 0.55 },
      ],
      // …e o selo de confirmado aparece sobre o telhado.
      [
        "[data-confirmado]",
        { opacity: [0, 1], transform: ["scale(0.4)", "scale(1)"] },
        { duration: 0.45, ease: [0.34, 1.56, 0.64, 1], at: ENTREGA + 0.65 },
      ],
    ]);

    return () => controles.stop();
  }, [animar, animate, cartao]);

  const { situacao, frase } = fraseDoSaldo({ restante: resumo.restante, nome, mes });
  const data = /^\d{4}-\d{2}-\d{2}$/.test(resumo.data) ? DATA.format(new Date(`${resumo.data}T00:00:00.000Z`)) : null;
  // O estado inicial de quem vai aparecer; sem animação, já o final.
  const escondido = animar ? { opacity: 0 } : undefined;

  return createPortal(
    <div
      className={`entrega fixed inset-0 z-[60] grid place-items-center p-4 ${saindo ? "entrega-saindo" : ""}`}
      onClick={sair}
    >
      {/* O desfoque de 2px da página por trás NÃO mora aqui: ver `.entrega-fundo`. */}
      <div className="entrega-fundo absolute inset-0 bg-black/45" />

      <div
        ref={cartao}
        role="dialog"
        aria-labelledby={idTitulo}
        onClick={(evento) => evento.stopPropagation()}
        style={escondido}
        className="relative w-full max-w-[28rem] rounded-suave border border-filete bg-folha p-5 text-center
          shadow-[var(--sombra-alta)]"
      >
        <Palco animar={animar} nome={nome} />

        <div data-texto="" style={escondido} className="mt-4">
          <h2 id={idTitulo} className="text-medio font-semibold text-tinta">
            Pagamento realizado com sucesso!
          </h2>
          <p className="mt-2 text-corpo text-tinta-2 leading-relaxed">
            <strong className="font-semibold text-tinta numerico">{formatarMoeda(resumo.valor)}</strong> pagos a{" "}
            {nome}
            {data && (
              <>
                {" "}
                em <strong className="font-semibold text-tinta numerico">{data}</strong>
              </>
            )}
            .
          </p>
          {resumo.observacao.trim() && (
            <p className="mt-1 text-corpo text-tinta-2 italic break-words">“{resumo.observacao.trim()}”</p>
          )}
          <p
            className={`mt-3 rounded-suave px-3 py-2.5 text-corpo font-semibold leading-relaxed numerico ${CORES_DA_SITUACAO[situacao]}`}
          >
            {frase}
          </p>
          <div className="mt-4 flex justify-center">
            <Botao ref={ok} type="button" onClick={sair} className="min-w-28 max-sm:w-full max-sm:py-3">
              Ok
            </Botao>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * O palco: a cena desenhada numa tela fixa (`LARGURA`×`ALTURA`), encaixada na
 * largura do cartão por um `scale` PARADO — muda só se a janela mudar de
 * tamanho. Assim as distâncias da animação são as mesmas em qualquer tela, e o
 * celular vê a mesma cena, menor.
 */
function Palco({ animar, nome }: { animar: boolean; nome: string }) {
  const palco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  // Antes de pintar, para o primeiro quadro já sair do tamanho certo.
  useLayoutEffect(() => {
    const elemento = palco.current;
    if (!elemento) return;
    const medir = () => setEscala(Math.min(1.15, elemento.clientWidth / LARGURA));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  // Quem aparece durante a animação nasce apagado; sem animação, já no fim.
  const apagado = animar ? { opacity: 0 } : undefined;
  const fim = !animar;

  return (
    <div ref={palco} aria-hidden="true" className="relative overflow-hidden" style={{ height: ALTURA * escala }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: LARGURA, height: ALTURA, transform: `scale(${escala})` }}
      >
        {/* O céu e o chão, parados. */}
        <div className="absolute left-[36px] top-[14px] h-[22px] w-[54px]">
          <Nuvem />
        </div>
        <div className="absolute left-[196px] top-[30px] h-[17px] w-[42px]">
          <Nuvem />
        </div>
        <div className="absolute inset-x-0 bg-folha-2" style={{ top: CHAO, bottom: 0 }} />
        <div className="absolute inset-x-0 h-0.5 bg-filete-forte" style={{ top: CHAO - 1 }} />
        <div className="absolute inset-x-0 flex justify-around" style={{ top: CHAO + 15 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="h-[3px] w-6 rounded-full bg-filete-forte" />
          ))}
        </div>

        {/* A casa de quem recebe, com o nome na placa. */}
        <div
          data-casa=""
          className="absolute origin-bottom"
          style={{ left: CASA.esquerda, top: CASA.topo, width: CASA.largura, height: CASA.altura }}
        >
          <Casa />
          <span
            data-nome=""
            className="absolute truncate px-1 text-center text-[11px] font-bold leading-[18px]"
            style={{ left: 18, top: 49, width: 72, height: 18, color: "#1e2433" }}
          >
            {nome}
          </span>
        </div>

        {/* O selo de confirmado, sobre o telhado. */}
        <div
          data-confirmado=""
          style={{ ...apagado, left: CASA.esquerda + 54 - 22, top: CASA.topo - 46 }}
          className="absolute grid size-11 place-items-center rounded-full bg-verde text-papel shadow-[var(--sombra)]"
        >
          <CircleCheck size={28} strokeWidth={2.25} />
        </div>

        {/* A poeira: fica onde o caminhão arrancou. */}
        <div className="absolute" style={{ left: CAMINHAO.esquerda + 22, top: CHAO - 6 }}>
          {[11, 15, 9].map((tamanho, i) => (
            <span
              key={i}
              data-poeira=""
              style={{ opacity: 0, width: tamanho, height: tamanho, left: -i * 8, top: -i * 5 }}
              className="absolute rounded-full bg-tinta-3/40"
            />
          ))}
        </div>

        {/* O caminhão: sem animação, já parado na frente da casa. */}
        <div
          data-caminhao=""
          className="absolute"
          style={{
            left: CAMINHAO.esquerda,
            top: CAMINHAO.topo,
            width: CAMINHAO.largura,
            height: CAMINHAO.altura,
            transform: fim ? `translateX(${CAMINHAO.anda}px)` : undefined,
          }}
        >
          {/* A sombra no chão, que anda junto. */}
          <div className="absolute left-[10px] top-[95px] h-[8px] w-[154px] rounded-full bg-black/25" />

          {/* Os riscos de velocidade, atrás da caçamba. */}
          <div className="absolute -left-8 top-[40px] flex flex-col gap-2">
            {[26, 18, 22].map((largura, i) => (
              <span
                key={i}
                data-velocidade=""
                style={{ opacity: 0, width: largura, marginLeft: i === 1 ? 8 : 0 }}
                className="h-[3px] rounded-full bg-tinta-3/50"
              />
            ))}
          </div>

          <div data-carroceria="" className="absolute inset-0">
            <TraseiraDoCaminhao />
            {/* O saco pousa com a base, por isso amassa a partir de baixo. Nasce
                apagado nos dois casos: com animação, aparece ao cair; sem ela,
                já foi entregue — está dentro da casa. */}
            <div
              data-saco=""
              className="absolute"
              style={{
                opacity: 0,
                transformOrigin: "50% 100%",
                left: SACO.esquerda,
                top: SACO.topo,
                width: SACO.largura,
                height: SACO.altura,
              }}
            >
              <SacoDeDinheiro />
            </div>
            {MOEDAS.map((moeda, i) => (
              <div
                key={i}
                data-moeda=""
                className="absolute size-4"
                style={{ ...apagado, left: moeda.esquerda, top: moeda.topo }}
              >
                <Moeda />
              </div>
            ))}
            <LateralDaCacamba />
          </div>

          {/* As rodas, fora da carroceria: a suspensão abaixa o caminhão, não o pneu. */}
          <div data-roda="" className="absolute left-[25px] top-[70px] size-[30px]">
            <Roda />
          </div>
          <div data-roda="" className="absolute left-[121px] top-[70px] size-[30px]">
            <Roda />
          </div>
        </div>
      </div>
    </div>
  );
}
