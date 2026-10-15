/**
 * Regras do nome do escritório, num módulo sem `server-only`: o formulário de
 * cadastro (cliente) e a ação (servidor) leem o mesmo número — como
 * `senha-regras.ts`.
 *
 * 60 caracteres cabem o nome de uma representação de verdade, por extenso
 * ("Representações Comerciais de Embalagens Plásticas Ltda" tem 55) e barram
 * o parágrafo colado no campo. Mesmo dentro do limite, o topo do aplicativo
 * corta com "…" o que não couber ao lado das abas (`navegacao.tsx`).
 */
export const TAMANHO_MAXIMO_ESCRITORIO = 60;
