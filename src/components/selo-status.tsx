const ESTILOS: Record<string, { rotulo: string; classe: string }> = {
  ABERTO: {
    rotulo: "Aberto",
    classe: "border-borda-forte text-texto-suave",
  },
  ENVIADO: {
    // Enviado é o estado que dispara a comissão: merece o acento da marca.
    rotulo: "Enviado",
    classe: "border-transparent fundo-gradiente text-sobre-acento font-medium",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    classe: "border-perigo/40 bg-perigo-fraco text-perigo",
  },
};

export function SeloStatus({ status }: { status: string }) {
  const estilo = ESTILOS[status] ?? ESTILOS.ABERTO;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${estilo.classe}`}
    >
      {estilo.rotulo}
    </span>
  );
}
