/**
 * O desenho do "Pagamento realizado com sucesso": o caminhão, o saco de
 * dinheiro, as moedas e a casa do preposto.
 *
 * O primeiro desenho era um caminhão pequeno em traço fino azul e um saco
 * simples — e não agradou. Este é chapado e colorido, com contorno escuro
 * arredondado (estilo adesivo) e mais detalhe: cabine com motorista, farol,
 * para-lamas, caçamba de madeira, notas saindo do saco, moedas e a casa com o
 * nome de quem recebe.
 *
 * As cores do desenho são FIXAS (`CORES`), e não os tokens do tema: um
 * caminhão azul é azul no claro e no escuro, e o contorno escuro o separa de
 * qualquer fundo. Só o chão usa o tema, porque é o fundo da cena.
 *
 * Tudo aqui é medido numa tela fixa de `LARGURA`×`ALTURA`; o palco em
 * `pagamento-realizado.tsx` a encaixa no cartão com um `scale` parado. Cada
 * peça que se move é um elemento HTML com o seu SVG dentro — é o `transform`
 * do elemento que o Motion anima, no compositor.
 */

/** A tela do desenho, em pixels dele. */
export const LARGURA = 420;
export const ALTURA = 190;
/** A linha do chão. */
export const CHAO = 158;

/** O caminhão: a caixa dele, onde começa e quanto anda até a casa. */
export const CAMINHAO = { largura: 170, altura: 100, esquerda: 4, topo: CHAO - 100, anda: 131 };
/** O saco, dentro da caixa do caminhão. */
export const SACO = { esquerda: 32, topo: 10, largura: 46, altura: 54 };
/** A casa, na tela; a porta, dentro dela. */
export const CASA = { esquerda: 300, topo: 56, largura: 112, altura: 102, porta: { x: 68, y: 86 } };

/**
 * O pulo do saco até a porta: do centro dele, já com o caminhão parado na
 * frente da casa, até o centro da porta.
 */
export const PULO_DO_SACO = {
  x: CASA.esquerda + CASA.porta.x - (CAMINHAO.esquerda + CAMINHAO.anda + SACO.esquerda + SACO.largura / 2),
  y: CASA.topo + CASA.porta.y - (CAMINHAO.topo + SACO.topo + SACO.altura / 2),
};

const CORES = {
  contorno: "#1e2433",
  cabine: "#3b82f6",
  vidro: "#dbeafe",
  pele: "#f2c29b",
  bone: "#ef4444",
  camisa: "#facc15",
  farol: "#fde047",
  chassi: "#2d3142",
  parachoque: "#cbd5e1",
  madeira: "#d9924c",
  madeiraEscura: "#a8642d",
  pneu: "#2b2f3a",
  aro: "#e2e8f0",
  ouro: "#f7c948",
  ouroEscuro: "#b7791f",
  sombraDoOuro: "#e0a72a",
  corda: "#8a5a2b",
  nota: "#4ade80",
  notaEscura: "#15803d",
  parede: "#fde2c4",
  telhado: "#e05d44",
  tijolo: "#b4532f",
  porta: "#3b82f6",
  placa: "#ffffff",
  folhagem: "#4ade80",
  folhagemEscura: "#16a34a",
} as const;

const LINHA = {
  stroke: CORES.contorno,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** A cabine, o chassi, os para-lamas e o fundo da caçamba — o que fica atrás do saco. */
export function TraseiraDoCaminhao() {
  return (
    <svg viewBox="0 0 170 100" className="absolute inset-0 size-full overflow-visible">
      {/* O chassi, por baixo de tudo. */}
      <rect x="4" y="71" width="160" height="9" rx="3" fill={CORES.chassi} />
      {/* O fundo da caçamba, que aparece acima da lateral. */}
      <rect x="8" y="30" width="98" height="44" rx="2" fill={CORES.madeiraEscura} {...LINHA} strokeWidth={2.5} />
      <path d="M11 39 H103" stroke={CORES.madeira} strokeWidth={2} opacity={0.6} />
      {/* A cabine. */}
      <path
        d="M106 78 V28 Q106 22 112 22 H138 Q142 22 144 25 L156 44 H160 Q168 44 168 52 V74 Q168 78 164 78 Z"
        fill={CORES.cabine}
        {...LINHA}
        strokeWidth={2.5}
      />
      {/* O vidro, com o motorista e o reflexo. */}
      <path d="M113 29 H137 Q139 29 140 31 L150 45 H113 Z" fill={CORES.vidro} {...LINHA} strokeWidth={2} />
      <path d="M120 45 Q121 40.5 128 40.5 Q135 40.5 136 45 Z" fill={CORES.camisa} />
      <circle cx="128" cy="37" r="5.5" fill={CORES.pele} {...LINHA} strokeWidth={1.5} />
      <path d="M122.6 35.5 Q123 30 128 30 Q133 30 133.4 35.5 Z" fill={CORES.bone} {...LINHA} strokeWidth={1.5} />
      <path d="M133 35.5 H137.5" {...LINHA} strokeWidth={2} />
      <path d="M142 32 L146.5 39" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      {/* A porta: a emenda e a maçaneta. */}
      <path d="M112 50 V74" {...LINHA} strokeWidth={1.5} opacity={0.45} />
      <rect x="115" y="53" width="8" height="2.6" rx="1.3" fill={CORES.contorno} />
      {/* O retrovisor. */}
      <path d="M106 33 H102" {...LINHA} strokeWidth={2} />
      <rect x="97" y="28.5" width="5.5" height="10" rx="1.8" fill={CORES.cabine} {...LINHA} strokeWidth={1.5} />
      {/* A grade, o farol e o para-choque. */}
      <path d="M160 59 H166 M160 63 H166 M160 67 H166" {...LINHA} strokeWidth={1.5} opacity={0.55} />
      <circle cx="163" cy="51.5" r="3.2" fill={CORES.farol} {...LINHA} strokeWidth={1.5} />
      <rect x="155" y="71.5" width="15" height="7.5" rx="2.5" fill={CORES.parachoque} {...LINHA} strokeWidth={1.5} />
      {/*
        Os para-lamas, por cima das rodas: o arco do pneu, só até a altura do
        chassi — descendo até o meio da roda, as pontas pareciam perninhas.
      */}
      <path d="M22.1 78.5 A19 19 0 0 1 57.9 78.5" fill="none" stroke={CORES.chassi} strokeWidth={5} strokeLinecap="round" />
      <path d="M118.1 78.5 A19 19 0 0 1 153.9 78.5" fill="none" stroke={CORES.chassi} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/** A lateral da caçamba, POR CIMA do saco: é ela que o põe dentro da caçamba. */
export function LateralDaCacamba() {
  return (
    <svg viewBox="0 0 170 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <rect x="6" y="46" width="102" height="28" rx="3" fill={CORES.madeira} {...LINHA} strokeWidth={2.5} />
      <path d="M9 55.5 H105 M9 64.5 H105" stroke={CORES.madeiraEscura} strokeWidth={1.5} />
      <path d="M40 47.5 V72.5 M74 47.5 V72.5" stroke={CORES.madeiraEscura} strokeWidth={2.2} />
      <path d="M10 49 H104" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" opacity={0.35} />
    </svg>
  );
}

/** Um pneu com aro, calota e cinco parafusos — sem eles, o giro não se vê. */
export function Roda() {
  const parafusos = Array.from({ length: 5 }, (_, i) => {
    const angulo = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    return { x: 15 + Math.cos(angulo) * 5.4, y: 15 + Math.sin(angulo) * 5.4 };
  });
  return (
    <svg viewBox="0 0 30 30" className="size-full">
      <circle cx="15" cy="15" r="13.6" fill={CORES.pneu} {...LINHA} strokeWidth={1.5} />
      <circle cx="15" cy="15" r="8.4" fill={CORES.aro} />
      <circle cx="15" cy="15" r="3" fill={CORES.chassi} />
      {parafusos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.15" fill={CORES.chassi} />
      ))}
    </svg>
  );
}

/** O saco de dinheiro: dourado, amarrado, com o "R$" e as notas saindo pela boca. */
export function SacoDeDinheiro() {
  return (
    <svg viewBox="0 0 46 54" className="size-full overflow-visible">
      {/* As notas, atrás da boca. */}
      <g transform="rotate(-16 18 9)">
        <rect x="11" y="-2" width="13" height="16" rx="1.5" fill={CORES.nota} {...LINHA} strokeWidth={1.5} />
        <circle cx="17.5" cy="6" r="2.6" fill="none" stroke={CORES.notaEscura} strokeWidth={1.3} />
      </g>
      <g transform="rotate(14 28 9)">
        <rect x="22" y="-3" width="13" height="16" rx="1.5" fill={CORES.nota} {...LINHA} strokeWidth={1.5} />
        <circle cx="28.5" cy="5" r="2.6" fill="none" stroke={CORES.notaEscura} strokeWidth={1.3} />
      </g>
      {/* A boca, franzida. */}
      <path d="M14 17 L10 9 L17 12 L23 7 L29 12 L36 9 L32 17 Z" fill={CORES.ouro} {...LINHA} strokeWidth={2} />
      {/* O corpo, e o lado na sombra. */}
      <path d="M15 17.5 C4 25 2 51 23 52 C44 51 42 25 31 17.5 Z" fill={CORES.ouro} {...LINHA} strokeWidth={2.2} />
      <path d="M31.5 20 C39 28 41 46 26.5 50.5 C36.5 45 37 29 31.5 20 Z" fill={CORES.sombraDoOuro} opacity={0.85} />
      {/* A corda. */}
      <path d="M14 17.5 Q23 21 32 17.5" fill="none" stroke={CORES.corda} strokeWidth={3} strokeLinecap="round" />
      <text x="22" y="40" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#3b2a06">
        R$
      </text>
    </svg>
  );
}

/** Uma moeda dourada, com a borda e o "$". */
export function Moeda() {
  return (
    <svg viewBox="0 0 16 16" className="size-full overflow-visible">
      <circle cx="8" cy="8" r="7" fill={CORES.ouro} {...LINHA} strokeWidth={1.5} />
      <circle cx="8" cy="8" r="4.6" fill="none" stroke={CORES.ouroEscuro} strokeWidth={1.1} />
      <text x="8" y="10.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={CORES.ouroEscuro}>
        $
      </text>
    </svg>
  );
}

/**
 * A casa de quem recebe: telhado, chaminé, janela, porta, um arbusto e a placa
 * — o nome vai por cima, em HTML (`pagamento-realizado.tsx`), na fonte do app.
 */
export function Casa() {
  return (
    <svg viewBox="0 0 112 102" className="absolute inset-0 size-full overflow-visible">
      <rect x="70" y="10" width="11" height="24" rx="1.5" fill={CORES.tijolo} {...LINHA} strokeWidth={2} />
      <path d="M2 46 L54 8 L106 46 Z" fill={CORES.telhado} {...LINHA} strokeWidth={2.5} />
      <rect x="10" y="44" width="88" height="58" fill={CORES.parede} {...LINHA} strokeWidth={2.5} />
      {/* A placa, onde o nome entra. */}
      <rect x="18" y="49" width="72" height="18" rx="3.5" fill={CORES.placa} {...LINHA} strokeWidth={1.5} />
      {/* A janela, com a cruz. */}
      <rect x="17" y="73" width="22" height="20" rx="2" fill={CORES.vidro} {...LINHA} strokeWidth={2} />
      <path d="M28 73 V93 M17 83 H39" {...LINHA} strokeWidth={1.5} />
      {/* A porta, com a maçaneta, e o degrau. */}
      <rect x="56" y="70" width="24" height="32" rx="3" fill={CORES.porta} {...LINHA} strokeWidth={2.5} />
      <circle cx="75" cy="87" r="1.8" fill={CORES.farol} />
      {/* O arbusto, encostado na parede. */}
      <circle cx="101" cy="93" r="9" fill={CORES.folhagem} {...LINHA} strokeWidth={2} />
      <circle cx="110" cy="96" r="6.5" fill={CORES.folhagemEscura} {...LINHA} strokeWidth={2} />
    </svg>
  );
}

/** Uma nuvem clara, parada — só para a cena não ficar no vazio. */
export function Nuvem() {
  return (
    <svg viewBox="0 0 54 22" className="size-full text-filete-forte">
      <path
        d="M10 21 Q2 21 2 14.5 Q2 8.5 9 8 Q11 1.5 19 1.5 Q25.5 1.5 28 7 Q31 4 36 4.5 Q42.5 5 43.5 11 Q52 11 52 16 Q52 21 45 21 Z"
        fill="currentColor"
      />
    </svg>
  );
}
