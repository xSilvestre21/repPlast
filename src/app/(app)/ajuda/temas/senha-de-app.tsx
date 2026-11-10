"use client";

/**
 * "E-mail: a senha de app": ligar a caixa de e-mail ao sistema, passo a passo.
 *
 * É o ponto em que mais gente trava: o Gmail recusa a senha normal e só cria a
 * senha de app para quem já ativou a verificação em duas etapas — e a página
 * do Google não avisa isso, só diz que "não está disponível".
 *
 * Os passos se marcam como feitos, e a barra anda: quem para no meio (foi
 * buscar o celular) volta e sabe onde estava. Servidor, porta e links vêm de
 * `PRESETS` — os mesmos que Configurações usa.
 */

import { Check, ExternalLink } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Segmentado } from "@/components/ui";
import { VideoAjuda } from "@/components/video-ajuda";
import { PRESETS, PROVEDORES, type Provedor } from "@/lib/provedores-email";

import { Onde, Quadro, SUAVE, Texto } from "../pecas";

const DUAS_ETAPAS = "https://myaccount.google.com/signinoptions/twosv";

type Passo = { titulo: string; itens: ReactNode[]; link?: { href: string; rotulo: string } };

const PASSOS_GMAIL: Passo[] = [
  {
    titulo: "Ative a verificação em duas etapas",
    itens: [
      "Abra a sua Conta Google e entre com o e-mail que vai enviar os pedidos.",
      "No menu, clique em “Segurança” e procure “Verificação em duas etapas”.",
      "Clique em “Ativar a verificação em duas etapas” e informe o número do seu celular.",
      "O Google manda um código por SMS. Digite o código e confirme.",
      <>
        Pronto: daqui em diante, ao entrar no Gmail num aparelho novo, o Google pede a senha <em>e</em> um
        código no celular. O sistema não pede esse código — é para isso que serve a senha de app.
      </>,
    ],
    link: { href: DUAS_ETAPAS, rotulo: "Abrir a verificação em duas etapas" },
  },
  {
    titulo: "Crie a senha de app",
    itens: [
      "Abra a página “Senhas de app” do Google. Se ela disser que não está disponível, o passo 1 não foi concluído.",
      "Em “Nome do app”, escreva RepPlast e clique em “Criar”.",
      "Aparece uma senha de 16 letras, em quatro grupos. Copie agora: o Google só mostra uma vez.",
      "Essa senha serve só para o RepPlast. A senha do seu Gmail continua a mesma.",
    ],
    link: { href: PRESETS.GMAIL.link ?? "https://myaccount.google.com/apppasswords", rotulo: "Abrir Senhas de app" },
  },
  {
    titulo: "Cole no RepPlast e teste",
    itens: [
      "No RepPlast, abra Configurações, vá até a parte de e-mail e clique em “Adicionar conta”.",
      "Em “Onde fica esse e-mail”, escolha Gmail: servidor e porta se preenchem sozinhos.",
      "Cole as 16 letras no campo “Senha de app”, com ou sem os espaços.",
      "Clique em “Testar e salvar”: o sistema confere a conexão antes de guardar, sem mandar nada para " +
        "ninguém. Deu certo, os pedidos já saem da sua caixa.",
    ],
  },
];

const DEU_ERRADO: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O teste diz que a senha está errada",
    resposta:
      "Quase sempre é a senha normal do Gmail no lugar da senha de app. Crie uma senha de app nova " +
      "(passo 2) e cole as 16 letras.",
  },
  {
    pergunta: "A página “Senhas de app” não aparece",
    resposta:
      "A verificação em duas etapas não está ativa, ou a conta é de empresa ou escola e o administrador " +
      "dela bloqueou as senhas de app. No primeiro caso, refaça o passo 1; no segundo, fale com quem " +
      "administra o e-mail da empresa.",
  },
  {
    pergunta: "Troquei a senha do Gmail e parou de enviar",
    resposta:
      "Trocar a senha da Conta Google apaga as senhas de app. Crie outra (passo 2) e cole em Configurações.",
  },
  {
    pergunta: "Uso Outlook ou Hotmail e o teste falha com a senha certa",
    resposta:
      "A Microsoft vem desligando o envio por senha em contas pessoais. Se a verificação em duas etapas " +
      "estiver ativa, use uma senha de app; se mesmo assim falhar, use uma caixa do Gmail ou do seu domínio.",
  },
];

export function SenhaDeApp() {
  const [provedor, setProvedor] = useState<Provedor>("GMAIL");
  const preset = PRESETS[provedor];

  return (
    <div className="space-y-5">
      <Texto>
        Para o sistema enviar o pedido pela <strong className="text-tinta">sua</strong> caixa de e-mail, ele
        precisa de uma senha. O Gmail não aceita a senha normal: pede uma senha de app, feita só para isto.
      </Texto>

      <Segmentado
        nome="Onde fica o seu e-mail"
        atual={provedor}
        aoEscolher={setProvedor}
        opcoes={PROVEDORES.map((p) => ({ valor: p, rotulo: PRESETS[p].rotulo }))}
      />

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={provedor}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: SUAVE }}
          className="space-y-4"
        >
          {provedor === "GMAIL" ? (
            <PassosGmail />
          ) : (
            <Quadro>
              <p className="text-corpo text-tinta">{preset.ajuda}</p>
              {preset.host && (
                <p className="text-mini text-tinta-2 mt-3">
                  Ao escolher {preset.rotulo} em Configurações, o servidor ({preset.host}) e a porta ({preset.porta})
                  já vêm preenchidos.
                </p>
              )}
              {preset.link && (
                <a
                  href={preset.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-corpo font-semibold text-carimbo hover:underline"
                >
                  Abrir a página <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </Quadro>
          )}
        </m.div>
      </AnimatePresence>

      <div>
        <h3 className="text-corpo font-semibold text-tinta mb-2">Não deu certo?</h3>
        <ul className="divide-y divide-filete border-y border-filete">
          {DEU_ERRADO.map((item) => (
            <li key={item.pergunta} className="py-3">
              <p className="text-corpo font-medium text-tinta">{item.pergunta}</p>
              <p className="text-corpo text-tinta-2 mt-1 max-w-2xl">{item.resposta}</p>
            </li>
          ))}
        </ul>
      </div>

      <Onde>
        avatar (canto de cima) → <Link href="/configuracoes" className="text-carimbo hover:underline">Configurações</Link>{" "}
        → E-mail
      </Onde>
    </div>
  );
}

function PassosGmail() {
  const [feitos, setFeitos] = useState<ReadonlySet<number>>(new Set());
  const [aberto, setAberto] = useState(0);
  const video = PRESETS.GMAIL.video;

  function marcar(i: number) {
    const proximos = new Set(feitos);
    if (proximos.has(i)) {
      proximos.delete(i);
    } else {
      proximos.add(i);
      // Feito este, abre o seguinte: a pessoa segue lendo sem procurar.
      if (i < PASSOS_GMAIL.length - 1) setAberto(i + 1);
    }
    setFeitos(proximos);
  }

  const tudo = feitos.size === PASSOS_GMAIL.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-filete overflow-hidden" aria-hidden="true">
          <m.div
            className="h-full bg-verde origin-left"
            initial={false}
            animate={{ scaleX: feitos.size / PASSOS_GMAIL.length }}
            transition={{ duration: 0.4, ease: SUAVE }}
          />
        </div>
        <p className="text-mini text-tinta-2 numerico" role="status">
          {tudo ? "Tudo feito" : `${feitos.size} de ${PASSOS_GMAIL.length} feitos`}
        </p>
      </div>

      <ol className="space-y-3">
        {PASSOS_GMAIL.map((passo, i) => {
          const feito = feitos.has(i);
          const expandido = aberto === i;

          return (
            <li key={passo.titulo} className="rounded-suave border border-filete bg-folha-2 overflow-hidden">
              <div className="flex items-center gap-3 p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => marcar(i)}
                  aria-pressed={feito}
                  aria-label={feito ? `Desmarcar o passo ${i + 1}` : `Marcar o passo ${i + 1} como feito`}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-mini font-bold
                    cursor-pointer transition-colors duration-200 ${
                      feito ? "bg-verde border-verde text-papel" : "border-filete-forte text-tinta-2 hover:border-tinta"
                    }`}
                >
                  {feito ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : i + 1}
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? -1 : i)}
                  aria-expanded={expandido}
                  className={`flex-1 text-left text-corpo font-semibold cursor-pointer ${
                    feito ? "text-tinta-2 line-through decoration-filete-forte" : "text-tinta"
                  }`}
                >
                  {passo.titulo}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {expandido && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: SUAVE }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 sm:pl-[3.75rem]">
                      <ol className="list-decimal pl-5 space-y-1.5 text-corpo text-tinta-2 marker:text-tinta-3">
                        {passo.itens.map((item, n) => (
                          <li key={n}>{item}</li>
                        ))}
                      </ol>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        {passo.link && (
                          <a
                            href={passo.link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-corpo font-semibold text-carimbo hover:underline"
                          >
                            {passo.link.rotulo} <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        )}
                        {i === 1 && video && (
                          <VideoAjuda src={video.src} titulo="Como criar a senha de app" duracao={video.duracao} />
                        )}
                        {i === 2 && (
                          <Link href="/configuracoes" className="text-corpo font-semibold text-carimbo hover:underline">
                            Abrir Configurações →
                          </Link>
                        )}
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
