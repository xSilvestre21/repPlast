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

/**
 * A data, ou `null` se ela não existe. O `Date` não recusa 31/02 — vira 03/03
 * sem avisar —, então a volta para texto tem de dar a mesma data.
 */
function paraData(iso: DataIso): Date | null {
  const partes = FORMATO.exec(iso);
  if (!partes) return null;
  const data = new Date(Date.UTC(+partes[1], +partes[2] - 1, +partes[3], 12));
  if (Number.isNaN(data.getTime())) return null;
  return paraIso(data) === iso ? data : null;
}

function paraIso(data: Date): DataIso {
  return data.toISOString().slice(0, 10);
}

export function dataValida(iso: string): boolean {
  return paraData(iso) !== null;
}

/* -------------------------------------------------------------------------- */
/* A data digitada                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A data pontuada enquanto se digita: as barras entram sozinhas, e "15102026"
 * aparece "15/10/2026" — como `mascararHora` faz com os dois-pontos.
 *
 * Trabalha sobre os DÍGITOS. A barra (ou ponto, ou traço) que a pessoa
 * escreveu só serve para fechar um dia ou mês de um dígito: colar "5/3/26" dá
 * "05/03/26", e não "53/26". Onde só cabe uma leitura, ela é completada na
 * hora:
 *
 *   - o dia começando de 4 a 9 só pode ter um dígito ("5" → "05/");
 *   - os dois primeiros passando de 31: o primeiro é o dia ("35" → "03/05/");
 *   - o mês começando de 2 a 9 também ("153" → "15/03/").
 *
 * Nunca passa de "dd/mm/aaaa". Colar "2026-10-15", como sai de planilha e de
 * sistema, também dá "15/10/2026".
 */
export function mascararData(texto: string): string {
  const limpo = texto.trim();
  if (FORMATO.test(limpo)) return dataDigitada(limpo);

  const partes = limpo.split(/\D+/);
  let digitos = "";
  partes.forEach((parte, i) => {
    digitos += parte;
    const fechada = i < partes.length - 1;
    // "5/" ou "15/3/": o separador fechou o dia ou o mês com um dígito só.
    if (fechada && parte !== "" && (digitos.length === 1 || digitos.length === 3)) {
      digitos = `${digitos.slice(0, -1)}0${digitos.slice(-1)}`;
    }
  });
  if (digitos === "") return "";

  if (Number(digitos[0]) > 3 || (digitos.length >= 2 && Number(digitos.slice(0, 2)) > 31)) {
    digitos = `0${digitos}`;
  }
  if (digitos.length >= 3 && Number(digitos[2]) > 1) {
    digitos = `${digitos.slice(0, 2)}0${digitos.slice(2)}`;
  }

  digitos = digitos.slice(0, 8);
  if (digitos.length < 2) return digitos;
  if (digitos.length < 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * A data como a pessoa escreveu, ou `null` quando ela não existe.
 *
 * Aceita "15102026", "151026" (o ano é 2026) e "1510" (o ano de `hoje`), com
 * ou sem as barras. O ano vai de 2000 a 2099 — "0026" é engano de digitação,
 * não o ano 26.
 */
export function lerData(texto: string, hoje: DataIso): DataIso | null {
  const [dia = "", mes = "", ano = ""] = mascararData(texto).split("/");
  if (dia.length !== 2 || mes.length !== 2) return null;

  let anoInteiro: string;
  if (ano === "") anoInteiro = hoje.slice(0, 4);
  else if (ano.length === 2) anoInteiro = `20${ano}`;
  else if (ano.length === 4 && ano.startsWith("20")) anoInteiro = ano;
  else return null;

  const iso = `${anoInteiro}-${mes}-${dia}`;
  return dataValida(iso) ? iso : null;
}

/**
 * Se o texto já é uma data COMPLETA, com o ano de quatro dígitos — para valer
 * enquanto a pessoa digita. "15/10" e "15/10/20" ainda estão no caminho de
 * "15/10/2026": lidos ao pé da letra, o calendário pularia de ano à toa a cada
 * tecla. No Enter vale `lerData`, que aceita tudo.
 */
export function dataCompleta(texto: string): DataIso | null {
  const pontuado = mascararData(texto);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(pontuado) ? lerData(pontuado, "2000-01-01") : null;
}

/** "2026-10-15" → "15/10/2026", como a caixa de digitar mostra. */
export function dataDigitada(iso: DataIso | ""): string {
  return iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
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

/* -------------------------------------------------------------------------- */
/* Feriados e dias úteis                                                      */
/* -------------------------------------------------------------------------- */

/** Domingo de Páscoa (algoritmo gregoriano anônimo, de Meeus/Jones/Butcher). */
function pascoa(ano: number): DataIso {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const FERIADOS_FIXOS: [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Consciência Negra"],
  ["12-25", "Natal"],
];

const cacheFeriados = new Map<number, Map<DataIso, string>>();

/**
 * Os dias em que a indústria não trabalha, do ano inteiro.
 *
 * Os dez feriados nacionais de lei, mais Carnaval (segunda e terça) e Corpus
 * Christi. Esses três são só ponto facultativo, mas fábrica quase nunca roda
 * neles — e um prazo de "15 dias úteis" que conta a terça de Carnaval promete ao
 * cliente um dia que a indústria não vai entregar. Feriado estadual e municipal
 * fica de fora: muda de cidade para cidade, e o sistema não sabe onde fica cada
 * fábrica.
 */
export function feriadosDoAno(ano: number): Map<DataIso, string> {
  const pronto = cacheFeriados.get(ano);
  if (pronto) return pronto;

  const domingo = pascoa(ano);
  const feriados = new Map<DataIso, string>([
    ...FERIADOS_FIXOS.map(([mesDia, nome]) => [`${ano}-${mesDia}`, nome] as [DataIso, string]),
    [somarDias(domingo, -48), "Carnaval"],
    [somarDias(domingo, -47), "Carnaval"],
    [somarDias(domingo, -2), "Sexta-feira Santa"],
    [somarDias(domingo, 60), "Corpus Christi"],
  ]);
  cacheFeriados.set(ano, feriados);
  return feriados;
}

export function nomeDoFeriado(iso: DataIso): string | null {
  return feriadosDoAno(Number(iso.slice(0, 4))).get(iso) ?? null;
}

export function ehDiaUtil(iso: DataIso): boolean {
  return !ehFimDeSemana(iso) && nomeDoFeriado(iso) === null;
}

/**
 * `dias` dias úteis depois de `iso`, sem contar o próprio dia — "15 dias úteis"
 * a partir de hoje é o 15º dia útil de amanhã em diante, como se combina com
 * a indústria.
 */
export function somarDiasUteis(iso: DataIso, dias: number): DataIso {
  let data = iso;
  for (let contados = 0; contados < dias; ) {
    data = somarDias(data, 1);
    if (ehDiaUtil(data)) contados++;
  }
  return data;
}

/** Quantos dias úteis há depois de `de` até `ate`, inclusive. */
export function diasUteisEntre(de: DataIso, ate: DataIso): number {
  let contados = 0;
  for (let data = somarDias(de, 1); data <= ate; data = somarDias(data, 1)) {
    if (ehDiaUtil(data)) contados++;
  }
  return contados;
}

const MES_ANO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const SEM_ANO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const LEITURA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Outubro de 2026" — o título do calendário. */
export function nomeDoMes(iso: DataIso): string {
  return maiuscula(MES_ANO.format(paraData(iso)!));
}

/**
 * "Sex., 09 de out. de 2026" — o que o campo mostra fechado.
 *
 * Com `hoje` e a data no mesmo ano, o ano sai: "Sex., 09 de out." é como se fala,
 * e é o que deixa caber a distância ("em 15 dias (10 úteis)") numa coluna
 * estreita do formulário.
 */
export function dataCurta(iso: DataIso, hoje?: DataIso): string {
  const formato = hoje && hoje.slice(0, 4) === iso.slice(0, 4) ? SEM_ANO : POR_EXTENSO;
  return maiuscula(formato.format(paraData(iso)!));
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
