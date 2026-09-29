"use client";

/**
 * Enviar um documento por e-mail — o pedido para a indústria, a proposta para
 * o cliente.
 *
 * O diálogo é o "escrever e-mail" do sistema: de qual caixa sai, para quem (o
 * grupo padrão já marcado), cópias, assunto e texto editáveis, e o PDF anexado
 * com espaço para mais. As regras de limite e de destinatário são as de
 * `lib/envio-pedido.ts`, as mesmas que as ações conferem do outro lado. O que
 * muda de um documento para o outro chega em `documento`.
 */

import { Mail, Paperclip, Send, TriangleAlert, X } from "lucide-react";
import {
  type ReactNode,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Dialogo } from "./dialogo";
import { EntregaEnviado } from "./entrega-enviado";
import {
  AreaTexto,
  Botao,
  BotaoLink,
  Campo,
  CLASSE_CONTROLE,
  MensagemErro,
  Rotulo,
  Selecao,
} from "./ui";
import {
  type EstadoEnvio,
  LIMITE_ANEXOS_BYTES,
  formatarTamanho,
  lerListaEmails,
  montarDestinatarios,
} from "@/lib/envio-pedido";

/** Uma edição de preposto que o administrador ainda não conferiu. */
export type EdicaoAConferir = { id: string; quem: string; quando: string };

export type ContaEnvio = { id: string; email: string; nomeExibicao: string; padrao: boolean };
export type ContatoEnvio = {
  id: string;
  nome: string | null;
  setor: string | null;
  email: string;
  padrao: boolean;
};

/** O que muda entre mandar um pedido e mandar uma proposta. */
export type DocumentoEnvio = {
  /** "Enviar pedido por e-mail", "Reenviar proposta por e-mail". */
  titulo: string;
  descricao: string;
  /** "Para — QUALYPLAST", "Para — AKILAH". */
  rotuloPara: string;
  /** O que dizer quando não há contato nenhum para marcar. */
  semContatos: ReactNode;
  placeholderAvulsos: string;
  /** Oferecer guardar os digitados na lista de contatos (só onde há lista). */
  guardarAvulsosEm?: string;
  /** Cópia para o cliente — o pedido oferece; a proposta já vai para ele. */
  copiaCliente?: { apelido: string; email: string | null };
  /** O que falta escolher quando não há destinatário. */
  faltaDestinatario: string;
  /** O título do cartão que o avião entrega. */
  tituloEntrega: string;
  /** "este pedido", "esta proposta" — no aviso de edição de preposto. */
  este: string;
};

export function EnvioPorEmail({
  jaEnviado,
  documento,
  aConferir = [],
  acao,
  contas,
  contatos,
  textoPadrao,
  nomeArquivoPdf,
}: {
  jaEnviado: boolean;
  documento: DocumentoEnvio;
  /** Vazio para quem não é administrador: o aviso é dele. */
  aConferir?: EdicaoAConferir[];
  acao: (estado: EstadoEnvio, formData: FormData) => Promise<EstadoEnvio>;
  contas: ContaEnvio[];
  contatos: ContatoEnvio[];
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
   * documento saía, e o aviso de enviado nunca aparecia. Este botão não desmonta.
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
          titulo={documento.tituloEntrega}
          para={enviado.para}
          cc={enviado.cc}
          aviso={enviado.aviso}
          fechar={fecharEntrega}
        />
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={documento.titulo}
        descricao={documento.descricao}
      >
        <FormEnvio
          estado={estado}
          enviando={enviando}
          submeter={submeter}
          documento={documento}
          contas={contas}
          contatos={contatos}
          textoPadrao={textoPadrao}
          nomeArquivoPdf={nomeArquivoPdf}
          aConferir={aConferir}
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
  documento,
  contas,
  contatos,
  textoPadrao,
  nomeArquivoPdf,
  aConferir,
  cancelar,
}: {
  estado: EstadoEnvio;
  enviando: boolean;
  submeter: (dados: FormData, para: string[], cc: string[]) => void;
  documento: DocumentoEnvio;
  contas: ContaEnvio[];
  contatos: ContatoEnvio[];
  textoPadrao: { assunto: string; corpo: string };
  nomeArquivoPdf: string;
  aConferir: EdicaoAConferir[];
  cancelar: () => void;
}) {
  // Sem edição a conferir, não há o que marcar — vale como conferido.
  const [conferido, setConferido] = useState(aConferir.length === 0);
  const [contaId, setContaId] = useState(
    contas.find((c) => c.padrao)?.id ?? contas[0]?.id ?? "",
  );
  const [marcados, setMarcados] = useState(
    () => new Set(contatos.filter((c) => c.padrao).map((c) => c.id)),
  );
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
    copiaCliente: copiaCliente ? documento.copiaCliente?.email : null,
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
          O envio sai do seu próprio e-mail, e você ainda não cadastrou nenhum. Leva um minuto:
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

      {/*
        Documento mexido por preposto: o administrador vê quem e quando antes de
        mandar, e só manda depois de dizer que conferiu. O servidor cobra a
        mesma caixa — desabilitar o botão aqui é só para não deixar tentar.
      */}
      {aConferir.length > 0 && (
        <div className="rounded-suave border border-filete-forte bg-destaque-fraco px-4 py-3 text-corpo">
          <p className="flex items-center gap-2 font-semibold text-tinta">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            {aConferir.length === 1
              ? `Um preposto editou ${documento.este}`
              : `Prepostos editaram ${documento.este}`}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-tinta-2">
            {aConferir.map((edicao) => (
              <li key={edicao.id}>
                {edicao.quem} · <span className="numerico">{edicao.quando}</span>
              </li>
            ))}
          </ul>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 font-medium text-tinta">
            <input
              type="checkbox"
              name="conferido"
              checked={conferido}
              onChange={(e) => setConferido(e.target.checked)}
              className="size-4 accent-[var(--carimbo)]"
            />
            Conferi as alterações
          </label>
        </div>
      )}

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
          <Rotulo>{documento.rotuloPara}</Rotulo>
        </legend>

        {contatos.length === 0 ? (
          <p className="text-mini text-tinta-2">{documento.semContatos}</p>
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
          placeholder={documento.placeholderAvulsos}
          dica="Separe por vírgula."
        />
        {documento.guardarAvulsosEm && lerListaEmails(avulsos).length > 0 && (
          <label className="flex items-center gap-2 text-mini text-tinta-2">
            <input type="checkbox" name="salvarAvulsos" className="size-4 accent-carimbo" />
            Guardar na lista de contatos da {documento.guardarAvulsosEm}
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
        {documento.copiaCliente && (
          <label
            className={`flex items-center gap-2 text-corpo ${documento.copiaCliente.email ? "" : "opacity-50"}`}
          >
            <input
              type="checkbox"
              name="copiaCliente"
              checked={copiaCliente}
              disabled={!documento.copiaCliente.email}
              onChange={(e) => setCopiaCliente(e.target.checked)}
              className="size-4 accent-carimbo"
            />
            Para o cliente{" "}
            {documento.copiaCliente.email
              ? `(${documento.copiaCliente.email})`
              : `— a ${documento.copiaCliente.apelido} não tem e-mail cadastrado`}
          </label>
        )}
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
          disabled={para.length === 0 || passou || !conferido}
          title={
            !conferido
              ? "Confira as alterações do preposto antes de enviar"
              : para.length === 0
                ? documento.faltaDestinatario
                : undefined
          }
        >
          {enviando
            ? "Enviando…"
            : `Enviar${para.length + cc.length > 0 ? ` (${para.length + cc.length})` : ""}`}
        </Botao>
      </div>
    </form>
  );
}
