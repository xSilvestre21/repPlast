/**
 * Preparo dos testes de navegador.
 *
 * `vitest-browser-react` traz os tipos do `render` e a limpeza entre um teste e
 * outro — sem ela o componente anterior continuaria na página e atrapalharia a
 * medida do seguinte.
 *
 * O CSS não é enfeite aqui: `absolute`, `top-full` e `bottom-full` são classes
 * do Tailwind, e é delas que sai o posicionamento que estes testes medem. Sem a
 * folha de estilo a lista ficaria em fluxo normal e o teste mediria outra coisa.
 */

import "vitest-browser-react";

import "../src/app/globals.css";
