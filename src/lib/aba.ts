/**
 * Fechar a guia ou o app encerra a sessão, como no app do banco.
 *
 * O cookie não dá conta disso sozinho: cookie de sessão só some quando o
 * navegador INTEIRO fecha, e no celular nem isso — fechar o app instalado, ou
 * a guia, deixa o cookie lá. Quem some com a guia é o `sessionStorage`: cada
 * guia tem o seu, e fechar a guia (ou o app) o apaga. Então a guia guarda ali a
 * marca de que fez login, e a página sem a marca encerra a sessão.
 *
 * A marca nasce do cookie `repplast_entrou`, que o servidor grava no login
 * (`criarSessao`) e a primeira página do sistema consome. Guia nova aberta
 * com outra já logada pergunta a ela antes (`GuardaDaAba`): abrir um segundo
 * pedido em outra guia não derruba ninguém.
 *
 * No celular, quase ninguém fecha o app: a pessoa troca de app ou bloqueia a
 * tela. Por isso, lá, 1 hora fora do app também pede a senha — 15 minutos
 * interrompiam o pedido pela metade de quem foi responder o cliente no
 * WhatsApp, e o pedido não tem rascunho.
 *
 * Mora fora de `guarda-da-aba.tsx` porque o layout (Server Component) usa o
 * `SCRIPT_ABA` — constante de módulo `'use client'` chega lá como referência.
 */

export const MARCA = "repplast_aba";
/** Quando a guia foi para o segundo plano (só no celular). */
export const OCULTA_EM = "repplast_oculta";
/** Quando a página foi descarregada: fechar a guia, recarregar, sair do site. */
export const SAIU_EM = "repplast_saiu";
export const COOKIE_ENTROU = "repplast_entrou";
export const CANAL = "repplast_aba";

export const AUSENCIA_CELULAR_MS = 60 * 60 * 1000;
/**
 * Página descarregada há mais que isso e aberta de novo sem ser recarregada:
 * é a guia fechada e reaberta (Ctrl+Shift+T, ou o navegador restaurando as
 * guias), que traz o `sessionStorage` de volta junto.
 */
export const REABERTA_MS = 5 * 1000;
/** Tela de toque: celular e tablet. O computador não tranca por ficar em outra guia. */
export const CELULAR = "(pointer: coarse)";

/**
 * Roda antes da primeira pintura, no carregamento completo da página: sem a
 * marca, esconde tudo (`html[data-aba]` em `globals.css`) até `GuardaDaAba`
 * decidir — senão as comissões apareceriam por um instante antes de sair.
 *
 * Mesma conta de `abaLiberada`, em JavaScript cru: é texto inserido no HTML.
 * Sem `sessionStorage` (navegador que o bloqueia), libera — trancar ali seria
 * trancar sempre.
 */
export const SCRIPT_ABA = `(function(){try{
var s=sessionStorage,a=Date.now(),n=performance.getEntriesByType('navigation')[0];
if(document.cookie.split('; ').indexOf('${COOKIE_ENTROU}=1')>=0){s.setItem('${MARCA}','1');s.removeItem('${OCULTA_EM}');s.removeItem('${SAIU_EM}');document.cookie='${COOKIE_ENTROU}=; Max-Age=0; path=/'}
var o=Number(s.getItem('${OCULTA_EM}')),d=Number(s.getItem('${SAIU_EM}'));
var recarga=n&&n.type==='reload';
if(!s.getItem('${MARCA}')||(d&&!recarga&&a-d>${REABERTA_MS})||(o&&matchMedia('${CELULAR}').matches&&a-o>${AUSENCIA_CELULAR_MS}))document.documentElement.dataset.aba='conferindo'
}catch(e){}})()`;
