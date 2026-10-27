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
 * Quanto esperar a resposta de outra guia logada antes de encerrar. Guia
 * aberta responde em milissegundos; a congelada pelo celular não responde
 * nunca, e esperar mais só atrasa a tela de entrar.
 */
export const ESPERA_RESPOSTA_MS = 200;

/** Encerra a sessão e responde com a tela de entrar, numa ida só ao servidor. */
export const ROTA_SAIR = "/api/sessao/sair";

/**
 * Roda na leitura da página, antes da primeira pintura: sem a marca, esconde
 * tudo (`html[data-aba]` em `globals.css`) — senão as comissões apareceriam
 * por um instante antes de sair — e decide ali mesmo, sem esperar o React.
 * Esperá-lo custava uns 2 segundos no celular, justo ao abrir o app instalado,
 * que começa no painel.
 *
 * A mesma conta de `GuardaDaAba`, em JavaScript cru: é texto inserido no
 * HTML. Quem cuida da navegação do React e da volta ao app é o componente.
 * Sem `sessionStorage` (navegador que o bloqueia), libera — trancar ali seria
 * trancar sempre.
 */
export const SCRIPT_ABA = `(function(){try{
var s=sessionStorage,h=document.documentElement,a=Date.now(),n=performance.getEntriesByType('navigation')[0];
if(document.cookie.split('; ').indexOf('${COOKIE_ENTROU}=1')>=0){s.setItem('${MARCA}','1');s.removeItem('${OCULTA_EM}');s.removeItem('${SAIU_EM}');document.cookie='${COOKIE_ENTROU}=; Max-Age=0; path=/'}
var o=Number(s.getItem('${OCULTA_EM}')),d=Number(s.getItem('${SAIU_EM}'));
if(d&&!(n&&n.type==='reload')&&a-d>${REABERTA_MS})s.removeItem('${MARCA}');
s.removeItem('${SAIU_EM}');
var ausente=o&&matchMedia('${CELULAR}').matches&&a-o>${AUSENCIA_CELULAR_MS};
if(s.getItem('${MARCA}')&&!ausente)return;
h.dataset.aba='conferindo';
var sair=function(){h.dataset.aba='saindo';s.removeItem('${MARCA}');var f=document.createElement('form');f.method='post';f.action='${ROTA_SAIR}';document.body.appendChild(f);f.submit()};
if(ausente||!window.BroadcastChannel)return sair();
var c=new BroadcastChannel('${CANAL}'),t=setTimeout(function(){c.close();sair()},${ESPERA_RESPOSTA_MS});
c.onmessage=function(e){if(e.data!=='logada')return;clearTimeout(t);c.close();s.setItem('${MARCA}','1');delete h.dataset.aba};
c.postMessage('alguma-logada?')
}catch(e){}})()`;
