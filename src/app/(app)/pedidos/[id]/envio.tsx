"use client";

/**
 * Envio do pedido por e-mail.
 *
 * Fica separado das outras ações porque é o único caminho que sai do sistema:
 * manda o PDF para a indústria e, dando certo, marca o pedido como enviado —
 * o que dispara a comissão.
 *
 * O diálogo é o "escrever e-mail" do sistema: de qual caixa sai, para quem na
 * indústria (o grupo padrão já marcado), cópias, assunto e texto editáveis, e
 * o PDF anexado com espaço para mais — o pedido de compra do cliente, quase
 * sempre. As regras de limite e de destinatário são as de `lib/envio-pedido.ts`,
 * as mesmas que a ação confere do outro lado.
 */

import Link from "next/link";
import { Mail, Paperclip, Send, X } from "lucide-react";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";

import { Dialogo } from "@/components/dialogo";
import {
  AreaTexto,
  Botao,
  BotaoLink,
  Campo,
  CLASSE_CONTROLE,
  MensagemErro,
  Rotulo,
  Selecao,
} from "@/components/ui";
import {
  LIMITE_ANEXOS_BYTES,
  formatarTamanho,
  lerListaEmails,
  montarDestinatarios,
} from "@/lib/envio-pedido";

import type { EstadoEnvio } from "../acoes";
import { EntregaEnviado } from "./entrega-enviado";

export type ContaEnvio = { id: string; email: string; nomeExibicao: string; padrao: boolean };
export type ContatoEnvio = { id: string; nome: string | null; setor: string | null; email: string; padrao: boolean };

export function BotaoEnviarEmail({
  jaEnviado,
  acao,
  contas,
  contatos,
  fornecedor,
  cliente,
  textoPadrao,
  nomeArquivoPdf,
}: {
  jaEnviado: boolean;
  acao: (estado: EstadoEnvio, formData: FormData) => Promise<EstadoEnvio>;
  contas: ContaEnvio[];
  contatos: ContatoEnvio[];
  fornecedor: { id: string; nome: string };
  cliente: { apelido: string; email: string | null };
  textoPadrao: { assunto: string; corpo: string };
  nomeArquivoPdf: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  // Estável: depois do envio a página revalida e este botão redesenha — uma
  // função nova a cada vez reiniciaria a contagem para o aviso sumir.
  const fecharEntrega = useCallback(() => setEnviado(null), []);

  /*
   * O estado do envio mora AQUI, e não no formulário.
   *
   * O formulário só existe com o diálogo aberto, e o envio leva uns cinco
   * segundos (o PDF, o servidor de e-mail). Quem fechava o diálogo nesse meio —
   * clique no fundo, Esc, o X — desmontava junto quem esperava a resposta: o
   * pedido saía, e o aviso de enviado nunca aparecia. Este botão não desmonta.
   */
  const [estado, enviar, enviando] = useActionState(acao, {});
  // Avisa só uma vez por submissão; o estado inicial e o de antes não contam.
  const avisado = useRef(true);
  // Para quem foi, guardado na hora do envio — é o que o aviso conta.
  const destinatarios = useRef<{ para: string[]; cc: string[] }>({ para: [], cc: [] });

  useEffect(() => {
    if (avisado.current) return;
    avisado.current = true;
    if (estado.enviado) {
      setEnviado({ ...destinatarios.current, aviso: estado.aviso });
      setAberto(false);
    } else if (estado.erro) {
      // Deu errado com o diálogo fechado: reabre, que é onde o erro aparece.
      // Com ele aberto, isto não muda nada.
      setAberto(true);
    }
  }, [estado]);

  const submeter = useCallback(
    (dados: FormData, para: string[], cc: string[]) => {
      avisado.current = false;
      destinatarios.current = { para, cc };
      startTransition(() => enviar(dados));
    },
    [enviar],
  );

  return (
    <>
      <Botao
        type="button"
        variante={jaEnviado ? "secundaria" : "primaria"}
        icone={Mail}
        // Fechado o diálogo no meio do envio, é aqui que se vê que ainda está indo.
        carregando={enviando}
        onClick={() => {
          setEnviado(null);
          setAberto(true);
        }}
      >
        {enviando ? "Enviando…" : jaEnviado ? "Reenviar por e-mail" : "Enviar por e-mail"}
      </Botao>

      {enviado && (
        <EntregaEnviado
          fornecedor={fornecedor.nome}
          para={enviado.para}
          cc={enviado.cc}
          aviso={enviado.aviso}
          fechar={fecharEntrega}
        />
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={jaEnviado ? "Reenviar pedido por e-mail" : "Enviar pedido por e-mail"}
        descricao={`Para a ${fornecedor.nome}. Dando certo, o pedido fica marcado como enviado.`}
      >
        <FormEnvio
          estado={estado}
          enviando={enviando}
          submeter={submeter}
          contas={contas}
          contatos={contatos}
          fornecedor={fornecedor}
          cliente={cliente}
          textoPadrao={textoPadrao}
          nomeArquivoPdf={nomeArquivoPdf}
          cancelar={() => setAberto(false)}
        />
      </Dialogo>
    </>
  );
}

type Enviado = { para: string[]; cc: string[]; aviso?: string };

function FormEnvio({
  estado,
  enviando,
  submeter,
  contas,
  contatos,
  fornecedor,
  cliente,
  textoPadrao,
  nomeArquivoPdf,
  cancelar,
}: {
  estado: EstadoEnvio;
  enviando: boolean;
  submeter: (dados: FormData, para: string[], cc: string[]) => void;
  contas: ContaEnvio[];
  contatos: ContatoEnvio[];
  fornecedor: { id: string; nome: string };
  cliente: { apelido: string; email: string | null };
  textoPadrao: { assunto: string; corpo: string };
  nomeArquivoPdf: string;
  cancelar: () => void;
}) {
  const [contaId, setContaId] = useState(contas.find((c) => c.padrao)?.id ?? contas[0]?.id ?? "");
  const [marcados, setMarcados] = useState(() => new Set(contatos.filter((c) => c.padrao).map((c) => c.id)));
  const [avulsos, setAvulsos] = useState("");
  const [copiaCliente, setCopiaCliente] = useState(false);
  const [copiaParaMim, setCopiaParaMim] = useState(true);
  const [anexos, setAnexos] = useState<File[]>([]);

  // O input que vai no formulário. Os arquivos moram no estado — assim dá para
  // escolher em várias idas e tirar um por um — e são copiados para ele aqui.
  const campoAnexos = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!campoAnexos.current) return;
    const lista = new DataTransfer();
    anexos.forEach((arquivo) => lista.items.add(arquivo));
    campoAnexos.current.files = lista.files;
  }, [anexos]);

  const conta = contas.find((c) => c.id === contaId);
  const { para, cc } = montarDestinatarios({
    contatos: contatos.filter((c) => marcados.has(c.id)).map((c) => c.email),
    avulsos: lerListaEmails(avulsos),
    copiaCliente: copiaCliente ? cliente.email : null,
    copiaParaMim: copiaParaMim ? conta?.email : null,
  });

  const totalExtras = anexos.reduce((soma, a) => soma + a.size, 0);
  // O PDF é montado no servidor e fica em torno de 100 KB; a conta aqui avisa
  // cedo, e a ação confere com o tamanho real.
  const passou = totalExtras > LIMITE_ANEXOS_BYTES - 200 * 1024;

  if (contas.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-corpo text-tinta-2 leading-relaxed">
          O pedido sai do seu próprio e-mail, e você ainda não cadastrou nenhum. Leva um minuto:
          escolha o serviço (Gmail, Outlook…) e cole a senha de app.
        </p>
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundaria" onClick={cancelar}>
            Agora não
          </Botao>
          <BotaoLink href="/configuracoes" icone={Mail}>
            Cadastrar meu e-mail
          </BotaoLink>
        </div>
      </div>
    );
  }

  return (
    <form
      // Submissão à mão, dentro de uma transição: com `action={...}` o React
      // limparia o formulário depois de cada envio — inclusive do que falhou,
      // levando junto o texto que a pessoa escreveu e os arquivos escolhidos.
      onSubmit={(evento) => {
        evento.preventDefault();
        submeter(new FormData(evento.currentTarget), para, cc);
      }}
      className="space-y-5"
    >
      <MensagemErro>{estado.erro}</MensagemErro>

      <Selecao
        name="contaId"
        rotulo="De"
        value={contaId}
        onChange={(e) => setContaId(e.target.value)}
        dica={contas.length > 1 ? undefined : "Outras contas se cadastram em Configurações."}
      >
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nomeExibicao} &lt;{c.email}&gt;
          </option>
        ))}
      </Selecao>

      <fieldset className="space-y-2">
        <legend className="contents">
          <Rotulo>Para — {fornecedor.nome}</Rotulo>
        </legend>

        {contatos.length === 0 ? (
          <p className="text-mini text-tinta-2">
            Nenhum contato cadastrado nesta indústria. Digite o e-mail abaixo, ou{" "}
            <Link href={`/fornecedores/${fornecedor.id}`} className="text-carimbo font-medium hover:underline">
              cadastre os contatos dela
            </Link>
            .
          </p>
        ) : (
          <div className="rounded-suave border border-filete bg-folha-2 divide-y divide-filete">
            {contatos.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="contatoId"
                  value={c.id}
                  checked={marcados.has(c.id)}
                  onChange={(e) =>
                    setMarcados((atual) => {
                      const novo = new Set(atual);
                      if (e.target.checked) novo.add(c.id);
                      else novo.delete(c.id);
                      return novo;
                    })
                  }
                  className="size-4 accent-carimbo"
                />
                <span className="min-w-0 grow">
                  <span className="block truncate text-corpo">
                    {[c.nome, c.setor].filter(Boolean).join(" — ") || c.email}
                  </span>
                  {(c.nome || c.setor) && (
                    <span className="block truncate text-mini text-tinta-3">{c.email}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}

        <Campo
          name="emailsAvulsos"
          rotulo="Outros e-mails"
          value={avulsos}
          onChange={(e) => setAvulsos(e.target.value)}
          placeholder="alguem@industria.com.br"
          dica="Separe por vírgula."
        />
        {lerListaEmails(avulsos).length > 0 && (
          <label className="flex items-center gap-2 text-mini text-tinta-2">
            <input type="checkbox" name="salvarAvulsos" className="size-4 accent-carimbo" />
            Guardar na lista de contatos da {fornecedor.nome}
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="contents">
          <Rotulo>Cópias</Rotulo>
        </legend>
        <label className="flex items-center gap-2 text-corpo">
          <input
            type="checkbox"
            name="copiaParaMim"
            checked={copiaParaMim}
            onChange={(e) => setCopiaParaMim(e.target.checked)}
            className="size-4 accent-carimbo"
          />
          Para mim{conta ? ` (${conta.email})` : ""}
        </label>
        <label className={`flex items-center gap-2 text-corpo ${cliente.email ? "" : "opacity-50"}`}>
          <input
            type="checkbox"
            name="copiaCliente"
            checked={copiaCliente}
            disabled={!cliente.email}
            onChange={(e) => setCopiaCliente(e.target.checked)}
            className="size-4 accent-carimbo"
          />
          Para o cliente{" "}
          {cliente.email ? `(${cliente.email})` : `— a ${cliente.apelido} não tem e-mail cadastrado`}
        </label>
      </fieldset>

      <Campo name="assunto" rotulo="Assunto" required defaultValue={textoPadrao.assunto} />
      <AreaTexto name="corpo" rotulo="Mensagem" rows={7} defaultValue={textoPadrao.corpo} />

      <div className="space-y-2">
        <Rotulo>Anexos</Rotulo>
        <ul className="rounded-suave border border-filete bg-folha-2 divide-y divide-filete text-corpo">
          <li className="flex items-center gap-2 px-3.5 py-2.5">
            <Paperclip size={14} className="text-tinta-3 shrink-0" aria-hidden="true" />
            <span className="truncate grow">{nomeArquivoPdf}</span>
            <span className="text-mini text-tinta-3">sempre vai</span>
          </li>
          {anexos.map((arquivo, i) => (
            <li key={`${arquivo.name}-${i}`} className="flex items-center gap-2 px-3.5 py-2.5">
              <Paperclip size={14} className="text-tinta-3 shrink-0" aria-hidden="true" />
              <span className="truncate grow">{arquivo.name}</span>
              <span className="text-mini text-tinta-3 numerico">{formatarTamanho(arquivo.size)}</span>
              <button
                type="button"
                onClick={() => setAnexos((atual) => atual.filter((_, j) => j !== i))}
                aria-label={`Tirar ${arquivo.name}`}
                className="size-7 grid place-items-center rounded-full text-tinta-3 hover:text-perigo hover:bg-perigo-fraco cursor-pointer"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className={`${CLASSE_CONTROLE} w-auto! inline-flex items-center gap-2 cursor-pointer`}>
            <Paperclip size={14} aria-hidden="true" />
            <span className="text-corpo">Anexar arquivo</span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const escolhidos = Array.from(e.target.files ?? []);
                setAnexos((atual) => [...atual, ...escolhidos]);
                e.target.value = "";
              }}
            />
          </label>
          <span className={`text-mini ${passou ? "text-perigo font-medium" : "text-tinta-3"}`}>
            {anexos.length > 0 ? `${formatarTamanho(totalExtras)} + o PDF · ` : ""}limite{" "}
            {formatarTamanho(LIMITE_ANEXOS_BYTES)}
          </span>
        </div>

        {/* O que efetivamente vai no FormData; ver o efeito que o preenche. */}
        <input ref={campoAnexos} type="file" name="anexo" multiple hidden tabIndex={-1} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Botao type="button" variante="secundaria" onClick={cancelar} disabled={enviando}>
          Cancelar
        </Botao>
        <Botao
          type="submit"
          icone={Send}
          carregando={enviando}
          disabled={para.length === 0 || passou}
          title={para.length === 0 ? "Escolha pelo menos um destinatário na indústria" : undefined}
        >
          {enviando
            ? "Enviando…"
            : `Enviar${para.length + cc.length > 0 ? ` (${para.length + cc.length})` : ""}`}
        </Botao>
      </div>
    </form>
  );
}
