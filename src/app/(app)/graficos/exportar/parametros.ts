import { competenciaDe } from "@/lib/comissao";

/**
 * Os parâmetros que as três rotas de exportação leem da URL.
 *
 * Num lugar só porque são a MESMA janela que a tela está mostrando: se o PDF
 * aceitasse um valor de `meses` que a tela recusa, o relatório sairia de um
 * período que ninguém viu, e nada avisaria.
 */

const JANELAS = [3, 6, 12];
const JANELA_PADRAO = 6;

const CORTES = [30, 60, 90, 180];
const CORTE_PADRAO = 60;

export function parametrosDoRelatorio(url: URL): {
  competencia: string;
  meses: number;
  dias: number;
} {
  const mes = url.searchParams.get("mes");
  const meses = Number(url.searchParams.get("meses"));
  const dias = Number(url.searchParams.get("dias"));

  return {
    competencia: mes && /^\d{4}-\d{2}$/.test(mes) ? mes : competenciaDe(new Date()),
    meses: JANELAS.includes(meses) ? meses : JANELA_PADRAO,
    dias: CORTES.includes(dias) ? dias : CORTE_PADRAO,
  };
}
