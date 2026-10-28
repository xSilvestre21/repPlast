"use client";

/**
 * As caixas de e-mail de quem está logado — por onde os pedidos saem.
 *
 * Cada pessoa cadastra a própria (ou mais de uma: o Gmail pessoal e o e-mail
 * da empresa), e a padrão já vem escolhida no envio. Salvar testa a conexão
 * antes de gravar, então uma conta que aparece aqui é uma conta que funcionou.
 *
 * Cada caixa tem as suas assinaturas (a completa, a curta…), cuidadas na linha
 * dela: mexer numa assinatura não pede a senha nem testa a conexão de novo.
 */

import { AtSign, Check, Mail, Pencil, PenLine, PlugZap, Plus, Star, X } from "lucide-react";
import { type ReactNode, startTransition, useActionState, useEffect, useRef, useState } from "react";

import {
  Botao,
  BotaoTexto,
  Campo,
  CampoSenha,
  EstadoVazio,
  Mensagem,
  MensagemErro,
  Painel,
  SecaoCartao,
  Selecao,
  Selo,
} from "@/components/ui";
import { PRESETS, PROVEDORES, type Provedor, provedorDoEmail } from "@/lib/provedores-email";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { VideoAjuda } from "@/components/video-ajuda";
import { ErroGeral, Formulario } from "@/components/formulario";

import type { EstadoConta, EstadoFormulario } from "./acoes";
import { CampoAssinatura } from "./campo-assinatura";

/** Os campos que moram dentro do bloco recolhido "Servidor". */
const CAMPOS_DO_SERVIDOR = ["host", "porta", "seguranca", "usuarioSmtp"];

type AcaoConta = (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;
type AcaoBotao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export type AssinaturaVisivel = {
  id: string;
  nome: string;
  /** Já limpa no servidor. */
  html: string;
  padrao: boolean;
  salvar: AcaoConta;
  tornarPadrao: AcaoBotao;
  excluir: AcaoBotao;
};

export type ContaVisivel = {
  id: string;
  provedor: Provedor;
  email: string;
  nomeExibicao: string;
  host: string;
  porta: number;
  tlsDireto: boolean;
  usuarioSmtp: string;
  padrao: boolean;
  testadaEm: string | null;
  /** A padrão primeiro. Vazia: os e-mails desta caixa saem sem assinatura. */
  assinaturas: AssinaturaVisivel[];
  salvar: AcaoConta;
  testar: AcaoConta;
  tornarPadrao: AcaoConta;
  excluir: AcaoConta;
  adicionarAssinatura: AcaoConta;
};

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SecaoContasEmail({
  contas,
  adicionar,
  nomeUsuario,
  emailUsuario,
  criptoConfigurada,
  abrirCadastro = false,
}: {
  contas: ContaVisivel[];
  adicionar: AcaoConta;
  nomeUsuario: string;
  emailUsuario: string;
  criptoConfigurada: boolean;
  /** Chegou pelo "Cadastrar meu e-mail" do envio (`?conta=nova#nova-conta`). */
  abrirCadastro?: boolean;
}) {
  const [adicionando, setAdicionando] = useState(abrirCadastro && criptoConfigurada);
  const formNovo = useRef<HTMLDivElement>(null);

  /*
   * Quem chega pelo envio encontra o formulário já aberto e na tela, e não a
   * página no topo com o cadastro lá embaixo. A âncora sozinha não daria
   * conta: o esqueleto do `loading.tsx` monta antes, sem o alvo, e o Next
   * desiste do alvo que não achou. Ela fica para o `Pagina` não subir ao topo.
   */
  useEffect(() => {
    if (!abrirCadastro || !criptoConfigurada) return;
    // Na hora, como o `Pagina` ao chegar: deslizar desde o topo seria uma viagem.
    formNovo.current?.scrollIntoView({ block: "start", behavior: "instant" });
    // Cumprido o pedido, recarregar a página não reabre o formulário.
    history.replaceState(null, "", `${window.location.pathname}#email`);
  }, [abrirCadastro, criptoConfigurada]);

  return (
    <SecaoCartao
      icone={Mail}
      titulo="Contas de e-mail"
      descricao="Os pedidos saem do seu e-mail, e é para ele que a indústria responde. Salvar testa a conexão antes — conta que aparece aqui é conta que funcionou."
    >
      {!criptoConfigurada && (
        <div className="mb-4">
          <MensagemErro>
            Falta a chave EMAIL_CHAVE no .env do servidor. Sem ela, a senha do e-mail não pode ser
            guardada com segurança — peça para quem administra o sistema configurar.
          </MensagemErro>
        </div>
      )}

      <Painel className="mb-4">
        {contas.length === 0 ? (
          <EstadoVazio discreto icone={AtSign}>
            Nenhuma conta ainda. Adicione a sua para mandar pedidos direto daqui.
          </EstadoVazio>
        ) : (
          contas.map((conta) => <LinhaConta key={conta.id} conta={conta} />)
        )}
      </Painel>

      {adicionando ? (
        // `scroll-mt`: para abaixo da barra do topo, que é fixa.
        <div ref={formNovo} id="nova-conta" className="scroll-mt-20">
          <FormConta
            acao={async (estado, formData) => {
              const resultado = await adicionar(estado, formData);
              if (resultado.ok) setAdicionando(false);
              return resultado;
            }}
            inicial={{
              provedor: provedorDoEmail(emailUsuario) ?? "OUTRO",
              email: emailUsuario,
              nomeExibicao: nomeUsuario,
            }}
            primeira={contas.length === 0}
            cancelar={() => setAdicionando(false)}
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <Botao
            variante="secundaria"
            icone={Plus}
            disabled={!criptoConfigurada}
            onClick={() => setAdicionando(true)}
          >
            Adicionar conta
          </Botao>
        </div>
      )}
    </SecaoCartao>
  );
}

function LinhaConta({ conta }: { conta: ContaVisivel }) {
  const [editando, setEditando] = useState(false);
  const [teste, testar, testando] = useActionState(conta.testar, {});

  if (editando) {
    return (
      <div className="p-4">
        <FormConta
          acao={async (estado, formData) => {
            const resultado = await conta.salvar(estado, formData);
            if (resultado.ok) setEditando(false);
            return resultado;
          }}
          inicial={conta}
          editando
          cancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-3.5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold truncate">{conta.email}</span>
            {conta.padrao && (
              <Selo tom="carimbo" icone={Star}>
                Padrão
              </Selo>
            )}
          </div>
          <div className="text-mini text-tinta-3">
            {conta.nomeExibicao} · {PRESETS[conta.provedor].rotulo}
            {conta.testadaEm && ` · funcionou em ${DATA_HORA.format(new Date(conta.testadaEm))}`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action={testar}>
            <BotaoTexto type="submit" disabled={testando}>
              {testando ? "Testando…" : "Testar"}
            </BotaoTexto>
          </form>
          {!conta.padrao && (
            <AcaoComRecusa acao={conta.tornarPadrao}>
              <BotaoTexto type="submit">Tornar padrão</BotaoTexto>
            </AcaoComRecusa>
          )}
          <BotaoTexto type="button" onClick={() => setEditando(true)}>
            Editar
          </BotaoTexto>
          <AcaoComRecusa
            acao={conta.excluir}
            confirmar={{
              titulo: `Excluir a conta ${conta.email}?`,
              texto:
                "A senha guardada e as assinaturas vão junto, e pedidos e propostas não podem mais " +
                "ser enviados por esta caixa." +
                (conta.padrao ? " Ela é a padrão: a próxima conta da lista passa a ser a padrão." : "") +
                " O que já foi enviado continua registrado. Esta ação não pode ser desfeita.",
              rotulo: "Excluir",
            }}
          >
            <BotaoTexto type="submit" perigoso>
              Excluir
            </BotaoTexto>
          </AcaoComRecusa>
        </div>
      </div>

      <MensagemErro>{teste.erro}</MensagemErro>
      <Mensagem tom="verde">{teste.ok}</Mensagem>

      <ListaAssinaturas conta={conta} />
    </div>
  );
}

/**
 * As assinaturas da caixa, embaixo dela. No envio, a padrão já vem escolhida
 * e as outras ficam a um clique, com "Sem assinatura" no fim da lista.
 */
function ListaAssinaturas({ conta }: { conta: ContaVisivel }) {
  const [adicionando, setAdicionando] = useState(false);
  const { assinaturas } = conta;

  return (
    <div className="rounded-suave border border-filete bg-folha px-3.5 py-3 space-y-2.5">
      <div>
        <span className="flex items-center gap-1.5 text-corpo font-medium">
          <PenLine size={14} aria-hidden="true" className="text-tinta-3" />
          Assinaturas deste e-mail
        </span>
        <p className="text-mini text-tinta-3">
          {assinaturas.length === 0
            ? "Nenhuma ainda: os e-mails saem só com o texto. A assinatura vai no fim de todo pedido e proposta."
            : "A padrão já vem escolhida no envio; lá dá para trocar por outra ou mandar sem."}
        </p>
      </div>

      {assinaturas.length > 0 && (
        <ul className="divide-y divide-filete border-y border-filete">
          {assinaturas.map((assinatura) => (
            <LinhaAssinatura key={assinatura.id} assinatura={assinatura} provedor={conta.provedor} />
          ))}
        </ul>
      )}

      {adicionando ? (
        <FormAssinatura
          acao={async (estado, formData) => {
            const resultado = await conta.adicionarAssinatura(estado, formData);
            if (resultado.ok) setAdicionando(false);
            return resultado;
          }}
          inicial={{ nome: assinaturas.length === 0 ? "Principal" : "", html: "" }}
          provedor={conta.provedor}
          primeira={assinaturas.length === 0}
          cancelar={() => setAdicionando(false)}
        />
      ) : (
        <BotaoTexto type="button" onClick={() => setAdicionando(true)} className="inline-flex items-center gap-1">
          <Plus size={12} aria-hidden="true" />
          {assinaturas.length === 0 ? "Adicionar assinatura" : "Adicionar outra assinatura"}
        </BotaoTexto>
      )}
    </div>
  );
}

function LinhaAssinatura({ assinatura, provedor }: { assinatura: AssinaturaVisivel; provedor: Provedor }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className="py-3">
        <FormAssinatura
          acao={async (estado, formData) => {
            const resultado = await assinatura.salvar(estado, formData);
            if (resultado.ok) setEditando(false);
            return resultado;
          }}
          inicial={assinatura}
          provedor={provedor}
          cancelar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
      <span className="flex min-w-0 grow items-center gap-2">
        <span className="truncate text-corpo">{assinatura.nome}</span>
        {assinatura.padrao && (
          <Selo tom="carimbo" icone={Star}>
            Padrão
          </Selo>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {!assinatura.padrao && (
          <AcaoComRecusa acao={assinatura.tornarPadrao}>
            <BotaoTexto type="submit">Tornar padrão</BotaoTexto>
          </AcaoComRecusa>
        )}
        <BotaoTexto type="button" onClick={() => setEditando(true)}>
          Editar
        </BotaoTexto>
        <AcaoComRecusa
          acao={assinatura.excluir}
          confirmar={{
            titulo: `Excluir a assinatura “${assinatura.nome}”?`,
            texto:
              "Os próximos e-mails não poderão mais usá-la." +
              (assinatura.padrao ? " Ela é a padrão: a próxima da lista passa a ser a padrão." : "") +
              " O que já foi enviado não muda. Esta ação não pode ser desfeita.",
            rotulo: "Excluir",
          }}
        >
          <BotaoTexto type="submit" perigoso>
            Excluir
          </BotaoTexto>
        </AcaoComRecusa>
      </span>
    </li>
  );
}

function FormAssinatura({
  acao,
  inicial,
  provedor,
  primeira = false,
  cancelar,
}: {
  acao: AcaoConta;
  inicial: { nome: string; html: string; padrao?: boolean };
  provedor: Provedor;
  primeira?: boolean;
  cancelar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(acao, {});

  return (
    <Formulario
      estado={estado}
      // À mão, como o da conta: com `action={...}` o React limparia o
      // formulário na recusa, e a assinatura colada iria junto.
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        startTransition(() => enviar(dados));
      }}
      className="space-y-4 rounded-suave border border-filete bg-folha-2 p-4"
    >
      <Campo
        name="nome"
        rotulo="Nome da assinatura"
        required
        dica="Só para você reconhecer na hora de enviar — como “Completa”, “Curta” ou o nome da indústria."
        defaultValue={inicial.nome}
      />

      <CampoAssinatura
        inicial={inicial.html}
        erro={estado.campo === "assinatura" ? estado.erro : undefined}
        provedor={provedor}
      />

      <ErroGeral />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {primeira || inicial.padrao ? (
          <span className="text-mini text-tinta-3">
            {primeira ? "Primeira assinatura: vira a padrão." : "Esta é a assinatura padrão."}
          </span>
        ) : (
          <label className="flex items-center gap-2 text-corpo">
            <input type="checkbox" name="padrao" className="size-4 accent-carimbo" />
            Usar como padrão
          </label>
        )}

        <div className="flex gap-2">
          <Botao type="button" variante="secundaria" icone={X} onClick={cancelar}>
            Cancelar
          </Botao>
          <Botao type="submit" icone={Check} carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar assinatura"}
          </Botao>
        </div>
      </div>
    </Formulario>
  );
}

/** Um passo numerado do cadastro: quem nunca fez segue de cima para baixo. */
function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-carimbo-fraco text-mini font-semibold text-carimbo"
      >
        {numero}
      </span>
      <div className="min-w-0 grow space-y-3">
        <h3 className="text-corpo font-semibold leading-6">{titulo}</h3>
        {children}
      </div>
    </section>
  );
}

/**
 * Criar e editar são o mesmo formulário.
 *
 * Em passos, para quem nunca configurou e-mail em lugar nenhum: qual é o
 * e-mail, como você aparece, a senha. O servidor fica recolhido no fim — é o
 * "Serviço" do primeiro passo que o preenche.
 *
 * Servidor, porta e segurança são controlados porque o serviço escolhido os
 * reescreve; o resto fica solto, como nos outros formulários do sistema.
 */
function FormConta({
  acao,
  inicial,
  editando = false,
  primeira = false,
  cancelar,
}: {
  acao: AcaoConta;
  inicial: Partial<Omit<ContaVisivel, "provedor">> & { provedor: Provedor };
  editando?: boolean;
  primeira?: boolean;
  cancelar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(acao, {});
  const [provedor, setProvedor] = useState<Provedor>(inicial.provedor);
  const [host, setHost] = useState(inicial.host ?? PRESETS[inicial.provedor].host);
  const [porta, setPorta] = useState(String(inicial.porta ?? PRESETS[inicial.provedor].porta));
  const [tlsDireto, setTlsDireto] = useState(inicial.tlsDireto ?? PRESETS[inicial.provedor].tlsDireto);

  const preset = PRESETS[provedor];

  function trocarProvedor(novo: Provedor) {
    setProvedor(novo);
    // "Outro" não apaga o que já está: quem troca para ele quase sempre vai
    // ajustar um detalhe do servidor que já estava ali, não começar do zero.
    if (novo !== "OUTRO") {
      setHost(PRESETS[novo].host);
      setPorta(String(PRESETS[novo].porta));
      setTlsDireto(PRESETS[novo].tlsDireto);
    }
  }

  return (
    <Formulario
      estado={estado}
      // Submissão à mão: com `action={...}` o React limpa o formulário depois de
      // cada tentativa, inclusive da que falhou — e a pessoa perderia o que
      // digitou justo quando precisa só corrigir a senha.
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        startTransition(() => enviar(dados));
      }}
      className="space-y-5 rounded-suave border border-filete bg-folha p-4"
    >
      {!editando && (
        <p className="text-corpo text-tinta-2 leading-relaxed">
          Para mandar os pedidos pelo seu e-mail, o sistema entra na sua caixa do mesmo jeito que o
          aplicativo de e-mail do celular entra. Siga os três passos abaixo — no fim, “Testar e
          salvar” confere se deu certo antes de guardar, sem mandar nada para ninguém.
        </p>
      )}

      <Passo numero={1} titulo="Qual é o seu e-mail">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            name="email"
            rotulo="E-mail"
            type="email"
            required
            autoComplete="email"
            defaultValue={inicial.email}
            onChange={(e) => {
              // "@gmail.com" já diz o serviço; o da empresa a pessoa escolhe.
              const doEmail = provedorDoEmail(e.target.value);
              if (doEmail && doEmail !== provedor) trocarProvedor(doEmail);
            }}
          />
          <Selecao
            name="provedor"
            rotulo="Onde fica esse e-mail (serviço)"
            value={provedor}
            onChange={(e) => trocarProvedor(e.target.value as Provedor)}
            dica="Escolher aqui já preenche os dados do servidor, lá embaixo."
          >
            {PROVEDORES.map((p) => (
              <option key={p} value={p}>
                {PRESETS[p].rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <p className="text-mini text-tinta-2 leading-relaxed">
          Não sabe o serviço? Olhe o final do endereço: @gmail.com é Gmail; @hotmail.com, @outlook.com
          e @live.com são Outlook. E-mail com o nome da empresa (como @suaempresa.com.br) fica onde o
          site dela está hospedado — pergunte a quem cuida do site se é Hostinger ou Locaweb; se não
          for nenhum dos dois, escolha “Outro”.
        </p>
      </Passo>

      <Passo numero={2} titulo="Como você aparece para quem recebe">
        <Campo
          name="nomeExibicao"
          rotulo="Nome que aparece"
          required
          dica="É o que a indústria vê no “De:” — o seu nome ou o do escritório."
          defaultValue={inicial.nomeExibicao}
        />
      </Passo>

      <Passo numero={3} titulo={provedor === "GMAIL" ? "A senha de app do Gmail" : "A senha do e-mail"}>
        <CampoSenha
          name="senha"
          rotulo={provedor === "GMAIL" ? "Senha de app" : "Senha"}
          autoComplete="new-password"
          required={!editando}
          placeholder={editando ? "Em branco mantém a atual" : ""}
        />

        {/*
          A ajuda do serviço: a frase, os passos numerados para quem nunca fez,
          e o link e o vídeo lado a lado — o vídeo começa clicando neste link.
        */}
        <div className="text-mini text-tinta-2 leading-relaxed space-y-1.5">
          {/* A ajuda do "Outro" é sobre o servidor, e mora lá embaixo. */}
          <p>
            {provedor === "OUTRO"
              ? "Use a senha da caixa de e-mail — a mesma com que você entra no webmail."
              : preset.ajuda}
          </p>
          {preset.passos && (
            <ol className="list-decimal pl-5 space-y-0.5">
              {preset.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          )}
          {(preset.link || preset.video) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {preset.link && (
                <a
                  href={preset.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-carimbo font-medium hover:underline"
                >
                  Abrir a página
                </a>
              )}
              {preset.video && (
                <VideoAjuda
                  src={preset.video.src}
                  duracao={preset.video.duracao}
                  titulo={`Como criar a senha de app — ${preset.rotulo}`}
                />
              )}
            </div>
          )}
        </div>
      </Passo>

      {/*
        Servidor e porta ficam à vista mesmo com o preset: quando um provedor
        muda o endereço, a pessoa corrige aqui sem esperar uma versão nova.
        O título diz de onde os valores vieram — do "Serviço" do passo 1 —,
        para ninguém achar que precisa preencher isto à mão.
      */}
      {/* Abre sozinho quando o erro é de um campo daqui de dentro — fechado, a
          frase que diz o que corrigir ficaria escondida. */}
      <details
        open={provedor === "OUTRO" || CAMPOS_DO_SERVIDOR.includes(estado.campo ?? "")}
        className="group rounded-suave border border-filete bg-folha-2 px-3.5 py-2.5"
      >
        <summary className="text-mini text-tinta-2 cursor-pointer select-none">
          {provedor === "OUTRO" ? (
            <>
              <span className="font-medium text-tinta">Dados do servidor (SMTP)</span> — com “Outro”
              no serviço, preencha aqui
            </>
          ) : (
            <>
              <span className="font-medium text-tinta">Dados do servidor (SMTP)</span> — já preenchidos
              para {preset.rotulo} ({host}:{porta}). Não precisa mexer.
            </>
          )}
        </summary>
        <p className="mt-2 text-mini text-tinta-2 leading-relaxed">
          {provedor === "OUTRO"
            ? "Como o serviço escolhido no passo 1 é “Outro”, o sistema não sabe estes dados sozinho. " +
              preset.ajuda
            : `Estes dados vêm do serviço escolhido no passo 1 (${preset.rotulo}): trocar o serviço ` +
              "troca os dados aqui. Só mude se o seu provedor de e-mail tiver passado outros."}
        </p>
        <div className="grid gap-4 sm:grid-cols-4 mt-3">
          <Campo
            name="host"
            rotulo="Servidor SMTP"
            className="sm:col-span-2"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.seudominio.com.br"
          />
          <Campo
            name="porta"
            rotulo="Porta"
            inputMode="numeric"
            value={porta}
            onChange={(e) => setPorta(e.target.value)}
          />
          <Selecao
            name="seguranca"
            rotulo="Segurança"
            value={tlsDireto ? "ssl" : "starttls"}
            onChange={(e) => setTlsDireto(e.target.value === "ssl")}
          >
            <option value="ssl">SSL/TLS</option>
            <option value="starttls">STARTTLS</option>
          </Selecao>
          <Campo
            name="usuarioSmtp"
            rotulo="Usuário"
            className="sm:col-span-2"
            dica="Quase sempre o próprio e-mail. Em branco, usa ele."
            defaultValue={inicial.usuarioSmtp === inicial.email ? "" : inicial.usuarioSmtp}
          />
        </div>
      </details>

      {!editando && (
        <p className="text-mini text-tinta-3">
          A assinatura do e-mail (com logo e telefone) se adiciona depois de salvar, logo abaixo da conta.
        </p>
      )}

      <ErroGeral />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {primeira || inicial.padrao ? (
          <span className="text-mini text-tinta-3">
            {primeira ? "Primeira conta: vira a padrão." : "Esta é a sua conta padrão."}
          </span>
        ) : (
          <label className="flex items-center gap-2 text-corpo">
            <input type="checkbox" name="padrao" className="size-4 accent-carimbo" />
            Usar como padrão
          </label>
        )}

        <div className="flex gap-2">
          <Botao type="button" variante="secundaria" icone={X} onClick={cancelar}>
            Cancelar
          </Botao>
          <Botao type="submit" icone={editando ? Pencil : PlugZap} carregando={salvando}>
            {salvando ? "Testando conexão…" : "Testar e salvar"}
          </Botao>
        </div>
      </div>
    </Formulario>
  );
}
