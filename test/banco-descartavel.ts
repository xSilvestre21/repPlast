/**
 * Trava dos testes de integração: eles criam e apagam escritórios, e só rodam
 * num banco descartável.
 *
 * O banco desta máquina passa direto. Outro qualquer — o ensaio no banco da
 * AWS, antes do lançamento — só com `BANCO_DE_TESTE=descartavel`, dito de
 * propósito na linha de comando. Sem a trava, um `.env` apontado para a
 * produção por engano apagava dado de verdade.
 */

import { bancoEhLocal } from "@/lib/banco-local";

if (!bancoEhLocal(process.env.DATABASE_URL) && process.env.BANCO_DE_TESTE !== "descartavel") {
  throw new Error(
    "Os testes de integração criam e apagam escritórios, e o DATABASE_URL não aponta para esta máquina. " +
      "Se este banco é mesmo descartável, rode com BANCO_DE_TESTE=descartavel.",
  );
}
