/**
 * Regras de senha que a TELA precisa conhecer.
 *
 * Vive separado de `senha.ts` de propósito: aquele módulo usa `node:crypto` e
 * só existe no servidor. Importar uma constante de lá num componente de
 * cliente arrastaria o crypto inteiro para o navegador — onde `promisify` de
 * uma função inexistente estoura em tempo de execução. Aconteceu.
 */

export const TAMANHO_MINIMO_SENHA = 8;
