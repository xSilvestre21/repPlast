"use client";

/**
 * As caixas de e-mail de quem está logado — por onde os pedidos saem.
 *
 * Cada pessoa cadastra a própria (ou mais de uma: o Gmail pessoal e o e-mail
 * da empresa), e a padrão já vem escolhida no envio. Salvar testa a conexão
 * antes de gravar, então uma conta que aparece aqui é uma conta que funcionou.
 */

import { AtSign, Mail, Pencil, PlugZap, Plus, Star, X } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import {
  Botao,
  BotaoTexto,
  Campo,
  EstadoVazio,
  Mensagem,
  MensagemErro,
  Painel,
  SecaoCartao,
  Selecao,
  Selo,
} from "@/components/ui";
import { PRESETS, PROVEDORES, type Provedor } from "@/lib/provedores-email";

import type { EstadoConta } from "./acoes";

type AcaoConta = (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;

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
  salvar: AcaoConta;
  testar: AcaoConta;
  tornarPadrao: (formData: FormData) => Promise<void>;
  excluir: (formData: FormData) => Promise<void>;
};

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SecaoContasEmail({
  contas,
  adicionar,
  nomeUsuario,
  emailUsuario,
  criptoConfigurada,
}: {
  contas: ContaVisivel[];
  adicionar: AcaoConta;
  nomeUsuario: string;
  emailUsuario: string;
  criptoConfigurada: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);

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
        <FormConta
          acao={async (estado, formData) => {
            const resultado = await adicionar(estado, formData);
            if (resultado.ok) setAdicionando(false);
            return resultado;
          }}
          inicial={{
            provedor: emailUsuario.endsWith("@gmail.com") ? "GMAIL" : "OUTRO",
            email: emailUsuario,
            nomeExibicao: nomeUsuario,
          }}
          primeira={contas.length === 0}
          cancelar={() => setAdicionando(false)}
        />
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
            <form action={conta.tornarPadrao}>
              <BotaoTexto type="submit">Tornar padrão</BotaoTexto>
            </form>
          )}
          <BotaoTexto type="button" onClick={() => setEditando(true)}>
            Editar
          </BotaoTexto>
          <form
            action={conta.excluir}
            onSubmit={(evento) => {
              if (!confirm(`Excluir a conta ${conta.email}? A senha guardada vai junto.`)) {
                evento.preventDefault();
              }
            }}
          >
            <BotaoTexto type="submit" perigoso>
              Excluir
            </BotaoTexto>
          </form>
        </div>
      </div>

      <MensagemErro>{teste.erro}</MensagemErro>
      <Mensagem tom="verde">{teste.ok}</Mensagem>
    </div>
  );
}

/**
 * Criar e editar são o mesmo formulário.
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
    <form
      // Submissão à mão: com `action={...}` o React limpa o formulário depois de
      // cada tentativa, inclusive da que falhou — e a pessoa perderia o que
      // digitou justo quando precisa só corrigir a senha.
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        startTransition(() => enviar(dados));
      }}
      className="space-y-4 rounded-suave border border-filete bg-folha p-4"
    >
      <MensagemErro>{estado.erro}</MensagemErro>

      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao
          name="provedor"
          rotulo="Serviço"
          value={provedor}
          onChange={(e) => trocarProvedor(e.target.value as Provedor)}
        >
          {PROVEDORES.map((p) => (
            <option key={p} value={p}>
              {PRESETS[p].rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          name="email"
          rotulo="E-mail"
          type="email"
          required
          autoComplete="email"
          defaultValue={inicial.email}
        />
        <Campo
          name="nomeExibicao"
          rotulo="Nome que aparece"
          required
          dica="É o que a indústria vê no “De:”."
          defaultValue={inicial.nomeExibicao}
        />
        <Campo
          name="senha"
          rotulo={provedor === "GMAIL" ? "Senha de app" : "Senha"}
          type="password"
          autoComplete="new-password"
          required={!editando}
          placeholder={editando ? "Em branco mantém a atual" : ""}
        />
      </div>

      <p className="text-mini text-tinta-2 leading-relaxed">
        {preset.ajuda}{" "}
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
      </p>

      {/*
        Servidor e porta ficam à vista mesmo com o preset: quando um provedor
        muda o endereço, a pessoa corrige aqui sem esperar uma versão nova.
      */}
      <details open={provedor === "OUTRO"} className="group">
        <summary className="text-mini text-tinta-3 cursor-pointer select-none">
          Servidor ({host || "a preencher"}:{porta})
        </summary>
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
    </form>
  );
}
