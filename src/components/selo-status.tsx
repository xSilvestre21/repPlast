const ESTILOS: Record<string, { rotulo: string; classe: string }> = {
  ABERTO: {
    rotulo: "Aberto",
    classe: "border-borda-forte text-texto-suave",
  },
  ENVIADO: {
    rotulo: "Enviado",
    classe: "border-acento/50 bg-acento-escuro text-acento",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    classe: "border-perigo/40 bg-perigo-escuro text-perigo",
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
