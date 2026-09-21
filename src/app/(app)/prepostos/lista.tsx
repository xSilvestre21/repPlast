"use client";

/**
 * A lista de prepostos, com a ficha de cada um aberta na própria linha.
 *
 * Mesmo desenho da tabela de materiais: o administrador conferindo a equipe
 * está lendo uma lista e ajustando uma coisa aqui e ali, e uma janela por
 * preposto tiraria a lista da frente a cada ajuste.
 */

import { Factory, KeyRound, UserCheck, UserPlus, Users } from "lucide-react";
import { useActionState, useId, useState } from "react";

import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Campo,
  Cartao,
  Emblema,
  EstadoVazio,
  Mensagem,
  MensagemErro,
  SecaoCartao,
  Selo,
  ValorLinha,
} from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export type Preposto = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  /** Já no padrão brasileiro; vazio quando não há acordo definido. */
  comissaoPercentual: string;
  /** Indústrias que ele atende. Vazio = todas. */
  industrias: string[];
  clientes: number;
};

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

function Recado({ estado }: { estado: EstadoFormulario }) {
  return (
    <>
      <MensagemErro>{estado.erro}</MensagemErro>
      <Mensagem tom="verde">{estado.aviso}</Mensagem>
    </>
  );
}

function Ficha({
  preposto,
  salvar,
  trocarSenha,
  alternarAtivo,
}: {
  preposto: Preposto;
  salvar: Acao;
  trocarSenha: Acao;
  alternarAtivo: (formData: FormData) => void | Promise<void>;
}) {
  const [estadoDados, salvarDados, salvando] = useActionState(salvar, {});
  const [estadoSenha, enviarSenha, trocando] = useActionState(trocarSenha, {});
  const [aberto, setAberto] = useState(false);
  const painel = useId();

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-corpo font-medium ${preposto.ativo ? "" : "text-tinta-3"}`}>
              {preposto.nome}
            </span>
            {!preposto.ativo && <Selo>sem acesso</Selo>}
          </div>
          <div className="text-mini text-tinta-3 truncate">{preposto.email}</div>
        </div>

        <div className="flex items-center gap-4">
          <ValorLinha
            className="w-20"
            valor={preposto.comissaoPercentual ? `${preposto.comissaoPercentual}%` : "—"}
            nota="da comissão"
          />
          <ValorLinha
            className="w-20 hidden sm:block"
            valor={preposto.clientes}
            nota="cliente(s)"
          />

          <BotaoTexto
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls={painel}
          >
            {aberto ? "fechar" : "ficha"}
          </BotaoTexto>
        </div>
      </div>

      <div id={painel} hidden={!aberto} className="pt-3 mt-3 border-t border-filete space-y-4">
        <form action={salvarDados} className="flex flex-wrap items-end gap-3">
          <label className="basis-48 grow">
            <span className="rotulo block mb-1.5 text-tinta-2">Nome</span>
            <input name="nome" required defaultValue={preposto.nome} className={CLASSE_CONTROLE} />
          </label>

          <label className="basis-28 grow-0">
            <span className="rotulo block mb-1.5 text-tinta-2">% da comissão</span>
            <input
              name="comissaoPercentualPadrao"
              inputMode="decimal"
              placeholder="50"
              defaultValue={preposto.comissaoPercentual}
              className={`${CLASSE_CONTROLE} numerico`}
            />
          </label>

          <Botao type="submit" variante="secundaria" carregando={salvando} className="px-4 py-2">
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </form>
        <Recado estado={estadoDados} />

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 text-mini text-tinta-2">
          <span className="flex items-center gap-1.5">
            <Emblema icone={Factory} tom="fraco" className="size-3.5" />
            {preposto.industrias.length === 0
              ? "Atende todas as indústrias"
              : `Atende: ${preposto.industrias.join(", ")}`}
          </span>
          <span className="text-tinta-3">
            Quem atende cada indústria se define na página dela.
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-filete">
          <form action={enviarSenha} className="flex flex-wrap items-end gap-3">
            <label className="basis-52 grow">
              <span className="rotulo block mb-1.5 text-tinta-2">Nova senha</span>
              <input
                type="password"
                name="senha"
                autoComplete="new-password"
                placeholder="mínimo 8 caracteres"
                className={CLASSE_CONTROLE}
              />
            </label>
            <Botao
              type="submit"
              variante="secundaria"
              icone={KeyRound}
              carregando={trocando}
              className="px-4 py-2"
            >
              {trocando ? "Trocando…" : "Trocar senha"}
            </Botao>
          </form>

          <form action={alternarAtivo}>
            <BotaoTexto type="submit" perigoso={preposto.ativo}>
              {preposto.ativo ? "tirar o acesso" : "devolver o acesso"}
            </BotaoTexto>
          </form>
        </div>
        <Recado estado={estadoSenha} />
      </div>
    </div>
  );
}

/**
 * Uma ficha e as ações já ligadas ao id dela.
 *
 * As ações chegam PRONTAS do servidor, e não como uma função que recebe o id:
 * só a referência de uma server action atravessa a fronteira, e uma fábrica
 * comum seria recusada na renderização — em silêncio, deixando a lista vazia.
 */
export type FichaPreposto = {
  preposto: Preposto;
  salvar: Acao;
  trocarSenha: Acao;
  alternarAtivo: (formData: FormData) => void | Promise<void>;
};

export function ListaPrepostos({
  fichas,
  inscrever,
}: {
  fichas: FichaPreposto[];
  inscrever: Acao;
}) {
  const [estado, enviar, inscrevendo] = useActionState(inscrever, {});

  return (
    <div className="space-y-5">
      {fichas.length === 0 ? (
        <EstadoVazio icone={Users}>
          Nenhum preposto inscrito ainda.
          <br />
          Quem você inscrever aqui entra com o próprio login e enxerga só a carteira dele.
        </EstadoVazio>
      ) : (
        <Cartao>
          <div className="divide-y divide-filete">
            {fichas.map((f) => (
              <Ficha
                key={f.preposto.id}
                preposto={f.preposto}
                salvar={f.salvar}
                trocarSenha={f.trocarSenha}
                alternarAtivo={f.alternarAtivo}
              />
            ))}
          </div>
        </Cartao>
      )}

      <SecaoCartao
        icone={UserCheck}
        tom="mar"
        titulo="Inscrever preposto"
        descricao="Ele entra com o próprio e-mail e senha, e passa a ver apenas os clientes e pedidos dele. A senha que você definir aqui é provisória — combine com ele de trocá-la."
      >
        <form action={enviar} className="space-y-4">
          <Recado estado={estado} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              name="nome"
              rotulo="Nome"
              required
              placeholder="Maria Augusta Ferraz"
              dica="Nome e sobrenome — assina o rodapé das propostas dele."
            />
            <Campo
              name="email"
              rotulo="E-mail"
              type="email"
              required
              autoComplete="off"
              placeholder="maria@exemplo.com.br"
            />
            <Campo
              name="senha"
              rotulo="Senha provisória"
              type="password"
              required
              autoComplete="new-password"
              dica="Mínimo 8 caracteres."
            />
            <Campo
              name="comissaoPercentualPadrao"
              rotulo="% da comissão"
              inputMode="decimal"
              placeholder="50"
              dica="Fatia do que a indústria paga — não da venda."
            />
          </div>

          <div className="flex justify-end">
            <Botao type="submit" icone={UserPlus} carregando={inscrevendo}>
              {inscrevendo ? "Inscrevendo…" : "Inscrever"}
            </Botao>
          </div>
        </form>
      </SecaoCartao>
    </div>
  );
}
