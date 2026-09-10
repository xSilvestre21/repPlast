"use client";

import { useActionState, useRef, useState } from "react";

import { ImageUp } from "lucide-react";

import { Botao, BotaoTexto, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export function SecaoLogo({
  fornecedorId,
  nome,
  temLogo,
  versao,
  salvar,
  remover,
}: {
  fornecedorId: string;
  nome: string;
  temLogo: boolean;
  /** Muda a cada gravação, para o navegador não servir o logo antigo do cache. */
  versao: string;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(salvar, {});
  const [previa, setPrevia] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const src = previa ?? (temLogo ? `/fornecedores/${fornecedorId}/logo?v=${versao}` : null);

  return (
    <SecaoCartao
      icone={ImageUp}
      titulo="Logo da indústria"
      descricao="Vai no cabeçalho do PDF do pedido. É o logo da indústria, não o do seu escritório — é assim que o cliente dela está acostumado a receber."
    >
      <MensagemErro>{estado.erro}</MensagemErro>

      <form action={enviar} className="flex flex-wrap items-center gap-5 mt-3">
        <div
          className="grid place-items-center shrink-0 size-28 rounded-[3px] border border-filete bg-folha overflow-hidden"
          aria-live="polite"
        >
          {src ? (
            // O arquivo vem do banco por uma rota própria, e a prévia é um
            // blob: local — o otimizador do next/image não tem o que fazer aqui.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`Logo de ${nome}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-tinta-3 text-center px-2">sem logo</span>
          )}
        </div>

        <div className="flex-1 min-w-56 space-y-3">
          <input
            ref={entrada}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              setPrevia(arquivo ? URL.createObjectURL(arquivo) : null);
            }}
            className="block w-full text-sm text-tinta-2
              file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm
              file:font-medium file:cursor-pointer file:bg-tinta text-papel file:text-papel
              hover:file:brightness-110 file:transition-all"
          />

          <p className="text-xs text-tinta-3">
            PNG, JPEG ou WebP, até 2 MB. Fundo transparente fica melhor no papel.
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <Botao type="submit" variante="secundaria" disabled={enviando || previa === null}>
              {enviando ? "Enviando…" : "Salvar logo"}
            </Botao>

            {temLogo && (
              <BotaoTexto
                perigoso
                type="submit"
                formAction={remover}
                formNoValidate
                onClick={() => {
                  setPrevia(null);
                  if (entrada.current) entrada.current.value = "";
                }}
              >
                remover logo atual
              </BotaoTexto>
            )}
          </div>
        </div>
      </form>
    </SecaoCartao>
  );
}
