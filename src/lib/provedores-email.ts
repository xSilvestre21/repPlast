/**
 * O que se sabe de cada serviço de e-mail, para a pessoa não precisar saber.
 *
 * Escolher "Gmail" preenche servidor, porta e segurança, e mostra como tirar a
 * senha de app. Os valores vão para a conta e podem ser trocados ali — o preset
 * é ponto de partida, não regra. "Outro" não preenche nada: é o e-mail do
 * domínio próprio, e quem o tem sabe os dados ou os acha no painel da hospedagem.
 *
 * Módulo puro: a tela de configurações usa no navegador, a ação usa para
 * validar, e os testes rodam sem servidor.
 */

export const PROVEDORES = ["GMAIL", "OUTLOOK", "HOSTINGER", "LOCAWEB", "OUTRO"] as const;

export type Provedor = (typeof PROVEDORES)[number];

export type PresetProvedor = {
  rotulo: string;
  host: string;
  porta: number;
  /** TLS desde a conexão (465) ou STARTTLS (587). */
  tlsDireto: boolean;
  /** Onde a pessoa consegue a senha certa, e o que fazer lá. */
  ajuda: string;
  /**
   * O mesmo, em passos numerados, para quem nunca fez — com os nomes que
   * aparecem nas telas do serviço (e no vídeo, quando há).
   */
  passos?: string[];
  /** Link da página de ajuda, quando existe uma boa. */
  link?: string;
  /**
   * O vídeo de "Ver como fazer", em `public/ajuda/`. Só se preenche quando o
   * arquivo existe: sem ele, o botão nem aparece.
   */
  video?: { src: string; duracao: string };
};

export const PRESETS: Record<Provedor, PresetProvedor> = {
  GMAIL: {
    rotulo: "Gmail",
    host: "smtp.gmail.com",
    porta: 465,
    tlsDireto: true,
    ajuda: "O Gmail não aceita a sua senha normal aqui: ele pede uma senha de app, feita só para isto.",
    passos: [
      "Clique em “Abrir a página” e entre na sua conta Google. Se aparecer que a página não está " +
        "disponível, ative antes a “Verificação em duas etapas” e volte aqui.",
      "Em “Nome do app”, escreva RepPlast e clique em “Criar”.",
      "O Google mostra uma senha de 16 letras. Copie e cole no campo “Senha de app”, acima.",
    ],
    link: "https://myaccount.google.com/apppasswords",
  },
  OUTLOOK: {
    rotulo: "Outlook / Hotmail",
    host: "smtp-mail.outlook.com",
    porta: 587,
    tlsDireto: false,
    ajuda:
      "Use a senha da conta ou uma senha de app, se a verificação em duas etapas estiver " +
      "ativa. A Microsoft vem desligando o envio por senha em contas pessoais — se o teste " +
      "falhar mesmo com a senha certa, é isso.",
    link: "https://account.live.com/proofs/AppPassword",
  },
  HOSTINGER: {
    rotulo: "Hostinger",
    host: "smtp.hostinger.com",
    porta: 465,
    tlsDireto: true,
    ajuda: "Use o e-mail completo e a senha da caixa, a mesma do webmail da Hostinger.",
  },
  LOCAWEB: {
    rotulo: "Locaweb",
    host: "email-ssl.com.br",
    porta: 465,
    tlsDireto: true,
    ajuda: "Use o e-mail completo e a senha da caixa, a mesma do webmail da Locaweb.",
  },
  OUTRO: {
    rotulo: "Outro",
    host: "",
    porta: 587,
    tlsDireto: false,
    ajuda:
      "Servidor, porta e segurança estão no painel da sua hospedagem, em algo como " +
      "\"configurar cliente de e-mail\" ou \"SMTP\".",
  },
};

export function ehProvedor(valor: unknown): valor is Provedor {
  return typeof valor === "string" && (PROVEDORES as readonly string[]).includes(valor);
}
