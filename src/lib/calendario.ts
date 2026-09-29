/**
 * As contas do calendário do campo de data, fora da tela.
 *
 * Tudo trabalha com a data como texto `aaaa-mm-dd` — o mesmo formato que o
 * `<input type="date">` mandava e que a ação do pedido já lê —, e as contas
 * são feitas em UTC ao meio-dia, para que horário de verão e fuso nunca empurrem
 * um dia para o lado.
 */

export type DataIso = string;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function paraData(iso: DataIso): Date | null {
  const partes = FORMATO.exec(iso);
  if (!partes) return null;
  const data = new Date(Date.UTC(+partes[1], +partes[2] - 1, +partes[3], 12));
  return Number.isNaN(data.getTime()) ? null : data;
}

function paraIso(data: Date): DataIso {
  return data.toISOString().slice(0, 10);
}

export function dataValida(iso: string): boolean {
  return paraData(iso) !== null;
}

/** Hoje no relógio de quem está usando — não em UTC, que já virou o dia às 21h. */
export function hojeIso(agora = new Date()): DataIso {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function somarDias(iso: DataIso, dias: number): DataIso {
  const data = paraData(iso)!;
  data.setUTCDate(data.getUTCDate() + dias);
  return paraIso(data);
}

/** Mesmo dia, `meses` para frente ou para trás; 31/01 + 1 mês cai em 28/02. */
export function somarMeses(iso: DataIso, meses: number): DataIso {
  const data = paraData(iso)!;
  const dia = data.getUTCDate();
  data.setUTCDate(1);
  data.setUTCMonth(data.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
  data.setUTCDate(Math.min(dia, ultimo));
  return paraIso(data);
}

export function diasEntre(de: DataIso, ate: DataIso): number {
  return Math.round((paraData(ate)!.getTime() - paraData(de)!.getTime()) / 86_400_000);
}

/** O primeiro dia do mês da data — é por ele que o calendário sabe que mês mostrar. */
export function inicioDoMes(iso: DataIso): DataIso {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * As semanas do mês, de domingo a sábado, completadas com os dias vizinhos.
 *
 * Sempre seis semanas: com cinco num mês e seis no outro, o calendário mudaria
 * de altura ao trocar de mês e o botão de avançar fugiria do dedo.
 */
export function semanasDoMes(inicio: DataIso): DataIso[][] {
  const primeiro = paraData(inicioDoMes(inicio))!;
  const domingo = somarDias(paraIso(primeiro), -primeiro.getUTCDay());
  return Array.from({ length: 6 }, (_, semana) =>
    Array.from({ length: 7 }, (_, dia) => somarDias(domingo, semana * 7 + dia)),
  );
}

export function ehFimDeSemana(iso: DataIso): boolean {
  const dia = paraData(iso)!.getUTCDay();
  return dia === 0 || dia === 6;
}

const MES_ANO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const LEITURA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Outubro de 2026" — o título do calendário. */
export function nomeDoMes(iso: DataIso): string {
  return maiuscula(MES_ANO.format(paraData(iso)!));
}

/** "Sex., 09 de out. de 2026" — o que o campo mostra fechado. */
export function dataCurta(iso: DataIso): string {
  return maiuscula(POR_EXTENSO.format(paraData(iso)!));
}

/** "sexta-feira, 9 de outubro de 2026" — o que o leitor de tela anuncia no dia. */
export function dataPorExtenso(iso: DataIso): string {
  return LEITURA.format(paraData(iso)!);
}

/** "hoje", "amanhã", "em 10 dias", "há 3 dias" — a conta que a pessoa faria de cabeça. */
export function distanciaDeHoje(iso: DataIso, hoje: DataIso): string {
  const dias = diasEntre(hoje, iso);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}
