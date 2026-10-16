import { ErroDeCampo } from "./erro-formulario";
import { TAMANHO_MINIMO_SENHA } from "./senha-regras";

/**
 * A senha nova e a repetição — no cadastro, na redefinição pelo link e na
 * troca da própria senha, com as mesmas frases. Os campos são `senha` e
 * `confirmacao` nos três formulários.
 */
export function conferirSenhaNova(senha: string, confirmacao: string): void {
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    throw new ErroDeCampo(
      "senha",
      `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres. ` +
        "Misture letras e números para ficar mais difícil de adivinhar.",
    );
  }
  if (senha !== confirmacao) {
    throw new ErroDeCampo(
      "confirmacao",
      "A senha repetida não é igual à primeira. Digite as duas de novo, com calma.",
    );
  }
}
