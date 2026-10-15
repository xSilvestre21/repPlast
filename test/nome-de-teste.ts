/**
 * Nome de escritório para teste de integração.
 *
 * O nome do escritório é único no banco (`organizacao_nome_unico`), e um teste
 * que quebre no meio não chega ao `afterAll` que apaga o que criou: com nome
 * fixo, a sobra travaria a rodada seguinte com um erro que não é do teste.
 */

import { randomUUID } from "node:crypto";

export function nomeDeTeste(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}
