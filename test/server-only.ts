/**
 * Substituto do pacote `server-only` nos testes.
 *
 * O pacote real estoura fora de um componente de servidor do Next, e o Vitest
 * não é o Next. A proteção que interessa acontece no BUILD — impedir que um
 * módulo de servidor vá parar no pacote do navegador —, e essa continua valendo.
 */

export {};
