"use client";

/**
 * A página de Ajuda: busca, índice e os temas, cada um com a sua demonstração.
 *
 * As demonstrações fazem a conta de verdade (as funções de `lib/`), em vez de
 * descrevê-la: quem mexe na régua do parcelamento aqui já sabe o que vai ver
 * em Comissões.
 *
 * O motor de animação entra só nesta rota (`Movimento`, o mesmo corte da tela
 * de entrada): o resto do sistema não paga por ele. E obedece à preferência de
 * Configurações — com as animações desligadas (`data-animacoes`), o motion
 * deixa de mover e só troca o conteúdo.
 */

import {
  BadgePercent,
  CalendarClock,
  CircleHelp,
  Layers,
  Mail,
  MessageCircle,
  Route,
  Scissors,
  Search,
  SearchX,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { MotionConfig, useScroll } from "motion/react";
import * as m from "motion/react-m";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { BotaoCopiar } from "@/components/botao-copiar";
import { Movimento } from "@/components/entrada/movimento";
import { Botao, CLASSE_CONTROLE, Cartao, EstadoVazio, Placa } from "@/components/ui";
import { linkEmail, linkWhatsapp, SUPORTE, temWhatsapp, whatsappEscrito } from "@/lib/suporte";

import { SUAVE } from "./pecas";
import { filtrarTemas, type IdTema, type Tema } from "./temas";
import { Caminho } from "./temas/caminho";
import { Comissoes, Rateio } from "./temas/comissoes";
import { Erros } from "./temas/erros";
import { Faturamento } from "./temas/faturamento";
import { Parcelamento } from "./temas/parcelamento";
import { Plano } from "./temas/plano";
import { SenhaDeApp } from "./temas/senha-de-app";
import { Tabelas } from "./temas/tabelas";

type TomPlaca = "sol" | "mar" | "menta" | "pessego" | "lilas" | "neutro";

/** O ícone e a cor de cada tema. Aqui, e não em `temas.ts`: ícone não é dado. */
const APARENCIA: Record<IdTema, { icone: LucideIcon; tom: TomPlaca }> = {
  caminho: { icone: Route, tom: "mar" },
  "senha-de-app": { icone: Mail, tom: "pessego" },
  tabelas: { icone: Layers, tom: "menta" },
  parcelamento: { icone: Scissors, tom: "sol" },
  faturamento: { icone: CalendarClock, tom: "lilas" },
  comissoes: { icone: BadgePercent, tom: "mar" },
  rateio: { icone: Users, tom: "menta" },
  erros: { icone: CircleHelp, tom: "pessego" },
  plano: { icone: WalletCards, tom: "sol" },
};

function conteudo(id: IdTema, ehAdmin: boolean): ReactNode {
  switch (id) {
    case "caminho":
      return <Caminho />;
    case "senha-de-app":
      return <SenhaDeApp />;
    case "tabelas":
      return <Tabelas />;
    case "parcelamento":
      return <Parcelamento />;
    case "faturamento":
      return <Faturamento />;
    case "comissoes":
      return <Comissoes />;
    case "rateio":
      return <Rateio />;
    case "erros":
      return <Erros ehAdmin={ehAdmin} />;
    case "plano":
      return <Plano />;
  }
}

/** A preferência "reduzir animações" de Configurações, lida do `<html>`. */
function useAnimacoesDesligadas(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => document.documentElement.dataset.animacoes === "desativadas",
    () => false,
  );
}

export function Ajuda({ temas, ehAdmin }: { temas: Tema[]; ehAdmin: boolean }) {
  const [busca, setBusca] = useState("");
  const semAnimacao = useAnimacoesDesligadas();
  const achados = filtrarTemas(temas, busca);
  const buscando = busca.trim() !== "";

  return (
    <Movimento>
      <MotionConfig reducedMotion={semAnimacao ? "always" : "never"}>
        <ProgressoDaLeitura />

        <Contato />

        <div className="mt-6">
          <label className="block">
            <span className="rotulo block mb-1.5 text-tinta-2">O que você quer saber?</span>
            <span className="relative block">
              <Search
                size={15}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
              />
              <input
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Escape") setBusca("");
                }}
                placeholder="parcela, gmail, reajuste, comissão…"
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </span>
          </label>
        </div>

        {/* O índice: um cartão por tema, que leva até ele. */}
        {achados.length > 0 && (
          <nav aria-label="Temas da ajuda" className="mt-5">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achados.map((tema, i) => {
                const { icone, tom } = APARENCIA[tema.id];
                return (
                  <m.li
                    key={tema.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: SUAVE, delay: 0.04 * i }}
                    whileHover={{ y: -3 }}
                  >
                    <a
                      href={`#${tema.id}`}
                      className="folha flex h-full items-start gap-3 p-4 transition-shadow duration-200 hover:shadow-alta"
                    >
                      <Placa icone={icone} tom={tom} pequena />
                      <span className="min-w-0">
                        <span className="block text-corpo font-semibold text-tinta">{tema.titulo}</span>
                        <span className="block text-mini text-tinta-2 mt-0.5">{tema.resumo}</span>
                      </span>
                    </a>
                  </m.li>
                );
              })}
            </ul>
          </nav>
        )}

        {buscando && achados.length === 0 && (
          <div className="mt-5">
            <EstadoVazio
              icone={SearchX}
              titulo="Nada encontrado"
              acao={
                <Botao variante="secundaria" tamanho="compacto" onClick={() => setBusca("")}>
                  Limpar busca
                </Botao>
              }
            >
              Nenhum tema da ajuda fala de “{busca.trim()}”. Tente outra palavra — ou escreva para o suporte,
              logo acima.
            </EstadoVazio>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {achados.map((tema) => {
            const { icone, tom } = APARENCIA[tema.id];
            return (
              <m.section
                key={tema.id}
                id={tema.id}
                aria-labelledby={`${tema.id}-titulo`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.5, ease: SUAVE }}
                // A barra do topo é fixa: sem a margem, a âncora esconderia o título atrás dela.
                className="scroll-mt-20"
              >
                <Cartao className="p-5 sm:p-6">
                  <div className="mb-5">
                    <div className="titulo-regra">
                      <Placa icone={icone} tom={tom} pequena />
                      <h2 id={`${tema.id}-titulo`} className="text-realce font-semibold text-tinta">
                        {tema.titulo}
                      </h2>
                    </div>
                  </div>
                  {conteudo(tema.id, ehAdmin)}
                </Cartao>
              </m.section>
            );
          })}
        </div>

        {achados.length > 0 && (
          <div className="mt-8">
            <Contato titulo="Ainda com dúvida?" />
          </div>
        )}
      </MotionConfig>
    </Movimento>
  );
}

/** A linha fina no topo que enche conforme a página é lida. */
function ProgressoDaLeitura() {
  const { scrollYProgress } = useScroll();

  return (
    <m.div
      aria-hidden="true"
      style={{ scaleX: scrollYProgress }}
      className="fixed inset-x-0 top-14 z-30 h-0.5 origin-left bg-carimbo pointer-events-none"
    />
  );
}

/** Por onde falar com o suporte: WhatsApp (quando há número) e e-mail. */
function Contato({ titulo = "Fale com o suporte" }: { titulo?: string }) {
  return (
    <Cartao marcada className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 className="text-realce font-semibold text-tinta">{titulo}</h2>
          <p className="text-corpo text-tinta-2 mt-1">
            Não achou aqui? Escreva: a gente responde{temWhatsapp() ? " por WhatsApp ou e-mail" : " por e-mail"}.
          </p>
          <p className="text-mini text-tinta-2 mt-2 break-all">
            {temWhatsapp() && <span className="numerico">{whatsappEscrito()} · </span>}
            {SUPORTE.email}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {temWhatsapp() && (
            <a
              href={linkWhatsapp()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-tinta text-papel px-4 py-2
                text-corpo font-semibold shadow-suave transition-all duration-200 hover:-translate-y-0.5 hover:shadow-folha"
            >
              <MessageCircle size={15} strokeWidth={2.25} aria-hidden="true" />
              WhatsApp
            </a>
          )}
          <a
            href={linkEmail()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-folha text-tinta border border-filete-forte
              px-4 py-2 text-corpo font-semibold transition-colors duration-200 hover:bg-folha-2"
          >
            <Mail size={15} strokeWidth={2.25} aria-hidden="true" />
            Enviar e-mail
          </a>
          <BotaoCopiar texto={SUPORTE.email} rotulo="Copiar e-mail" />
        </div>
      </div>
    </Cartao>
  );
}
