"use client";

/**
 * "Ver como fazer": um vídeo curto, gravado pelo escritório, mostrando o
 * passo a passo de verdade — a frase explicando a senha de app não bastava
 * para quem não lida com computador.
 *
 * O arquivo mora no próprio sistema (`public/ajuda/`), e não no YouTube: nada
 * de terceiro, nem de cookie, e funciona na rede da empresa que bloqueia
 * vídeo de fora. `preload="none"`: só baixa quando a pessoa aperta o play.
 */

import { CirclePlay } from "lucide-react";
import { useState } from "react";

import { Dialogo } from "./dialogo";

export function VideoAjuda({
  src,
  titulo,
  duracao,
}: {
  src: string;
  titulo: string;
  /** "1 min" — no botão, para a pessoa saber que é rápido. */
  duracao: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 text-carimbo font-medium hover:underline cursor-pointer"
      >
        <CirclePlay size={14} aria-hidden="true" />
        Ver como fazer ({duracao})
      </button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={titulo}>
        <video
          src={src}
          controls
          playsInline
          preload="none"
          autoPlay
          className="w-full rounded-suave bg-black"
        >
          Este navegador não consegue mostrar o vídeo.
        </video>
      </Dialogo>
    </>
  );
}
