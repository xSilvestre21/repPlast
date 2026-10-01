import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { competenciaDe, deslocarCompetencia, intervaloDaCompetencia } from "@/lib/comissao";

import { SeletorMes } from "./seletor-mes";

/**
 * O que o seletor troca pelo mês escolhido. Mora aqui, e não no seletor:
 * constante importada de um arquivo `'use client'` chega ao servidor como
 * referência de cliente, não como a string.
 */
const MARCADOR_MES = "__MES__";

const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/**
 * "Setembro de 2026" com apenas a inicial maiúscula.
 *
 * O `capitalize` do CSS não serve: ele capitaliza toda palavra e produziria
 * "Setembro De 2026".
 */
export function nomeDoMes(competencia: string): string {
  const nome = MES_LONGO.format(intervaloDaCompetencia(competencia).de);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });

/**
 * "set/26" — o rótulo de eixo, onde "Setembro de 2026" não caberia.
 *
 * O ano vai junto mesmo numa janela curta: sem ele, uma série de doze meses
 * que atravessa o Ano-Novo mostra "jan" depois de "dez" sem dizer que mudou de
 * ano, e a leitura fica errada exatamente onde mais importa.
 */
export function rotuloCurtoDoMes(competencia: string): string {
  const [ano] = competencia.split("-");
  const nome = MES_CURTO.format(intervaloDaCompetencia(competencia).de).replace(".", "");
  return `${nome}/${ano.slice(2)}`;
}

/**
 * O mês como legenda da página, com as setas de cada lado — e o nome, que abre
 * a grade do ano para pular direto para um mês antigo (`seletor-mes.tsx`).
 *
 * Mora fora de `ui.tsx` pela razão já documentada em `campo-mascarado.tsx`:
 * aquele arquivo é importado por componentes de cliente, e trazer
 * `lib/comissao` para dentro dele arrastaria o `decimal.js` inteiro para o
 * bundle do navegador só por causa de duas setas.
 *
 * O `href` é função porque a competência não é o único parâmetro da URL: a aba
 * de gráficos carrega também a janela do histórico e o corte de positivação, e
 * trocar de mês não pode derrubá-los.
 */
export function NavegadorMes({
  competencia,
  href,
  destaques,
  rotuloDestaque,
  className = "",
}: {
  competencia: string;
  href: (competencia: string) => string;
  /** Meses marcados com um ponto verde na grade do seletor ("AAAA-MM"). */
  destaques?: string[];
  /** O que o ponto quer dizer, para o leitor de tela: "meta batida". */
  rotuloDestaque?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <Seta href={href(deslocarCompetencia(competencia, -1))} rotulo="Mês anterior">
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
      </Seta>
      <SeletorMes
        atual={competencia}
        hoje={competenciaDe(new Date())}
        rotulo={nomeDoMes(competencia)}
        modelo={href(MARCADOR_MES)}
        marcador={MARCADOR_MES}
        destaques={destaques}
        rotuloDestaque={rotuloDestaque}
      />
      <Seta href={href(deslocarCompetencia(competencia, 1))} rotulo="Próximo mês">
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </Seta>
    </div>
  );
}

function Seta({
  href,
  rotulo,
  children,
}: {
  href: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="grid place-items-center size-8 text-tinta-3
        transition-colors duration-150 hover:text-carimbo"
    >
      {children}
    </Link>
  );
}
