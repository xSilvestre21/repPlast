import { Font } from "@react-pdf/renderer";

/**
 * Desliga a quebra de palavra no meio.
 *
 * O @react-pdf hifeniza por um dicionário de inglês, e numa descrição em
 * português isso sai errado: "peso liquido" virava "peso liq-uido" na coluna
 * ITEM. Sem o callback a linha quebra no espaço, que é o que o modelo impresso
 * sempre fez — ele nunca hifenizou nada.
 *
 * O registro é do @react-pdf inteiro, não de um documento: vale para a proposta
 * e para o pedido, e é por isso que mora num arquivo que os dois importam, em
 * vez de escondido dentro de um deles.
 */
Font.registerHyphenationCallback((palavra) => [palavra]);
