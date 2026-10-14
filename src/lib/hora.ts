/**
 * Hora digitada, lida do jeito que as pessoas escrevem.
 *
 * Módulo puro: o seletor de hora usa no navegador, e o teste roda sem DOM.
 */

/**
 * A hora como a pessoa escreveu, ou `null` quando não dá para entender.
 *
 * Aceita os jeitos de sempre: "14:30", "14h30", "14.30", "1430", "930"
 * (09:30), "9" e "9h" (09:00). Com separador, o que vem depois dele são os
 * minutos ("14:5" é 14:05); sem, os dois últimos dígitos são os minutos quando
 * há mais de dois.
 */
export function lerHora(texto: string): string | null {
  const limpo = texto.trim().toLowerCase();
  if (limpo === "") return null;

  let horas: number;
  let minutos: number;
  const separado = limpo.match(/^(\d{1,2})\s*[:h.]\s*(\d{0,2})\s*(min)?$/);

  if (separado) {
    horas = Number(separado[1]);
    minutos = Number(separado[2] || "0");
  } else if (/^\d{1,4}$/.test(limpo)) {
    horas = limpo.length <= 2 ? Number(limpo) : Number(limpo.slice(0, -2));
    minutos = limpo.length <= 2 ? 0 : Number(limpo.slice(-2));
  } else {
    return null;
  }

  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/**
 * Se o texto já é uma hora COMPLETA — para valer enquanto a pessoa digita.
 *
 * "14h3" e "143" ainda estão no caminho de "14h30" e "1430": lidos ao pé da
 * letra virariam 14:03 e 01:43, e a tela pularia de período à toa a cada
 * tecla. Completo é: só a hora ("9", "14", "9h"), minutos com dois dígitos
 * depois do separador, ou quatro dígitos seguidos. No Enter vale `lerHora`,
 * que aceita tudo.
 */
export function horaCompleta(texto: string): string | null {
  const limpo = texto.trim().toLowerCase();
  const completo =
    /^\d{1,2}\s*h?$/.test(limpo) ||
    /^\d{1,2}\s*[:h.]\s*\d{2}\s*(min)?$/.test(limpo) ||
    /^\d{4}$/.test(limpo);
  return completo ? lerHora(limpo) : null;
}

/**
 * A hora pontuada enquanto se digita: os dois-pontos entram sozinhos.
 *
 * Trabalha sobre os DÍGITOS — o que a pessoa escreveu de separador só serve
 * para saber se a hora tem um dígito ("9h" → "09:"). Onde só cabe uma
 * leitura, ela é completada na hora:
 *
 *   - primeiro dígito de 3 a 9: só pode ser a hora inteira ("9" → "09:");
 *   - os dois primeiros passando de 23: o primeiro é a hora ("25" → "02:5");
 *   - minuto começando de 6 a 9: é o das unidades ("147" → "14:07").
 *
 * Nunca passa de "HH:MM". Colar "14h30" ou "1430" dá "14:30".
 */
export function mascararHora(texto: string): string {
  const limpo = texto.trim().toLowerCase();
  let digitos = limpo.replace(/\D/g, "");
  if (digitos === "") return "";

  const separadorCedo = /^\d\s*[:h.]/.test(limpo);
  if (separadorCedo || Number(digitos[0]) > 2) {
    digitos = `0${digitos}`;
  } else if (digitos.length >= 2 && Number(digitos.slice(0, 2)) > 23) {
    digitos = `0${digitos}`;
  }

  if (digitos.length >= 3 && Number(digitos[2]) > 5) {
    digitos = `${digitos.slice(0, 2)}0${digitos.slice(2)}`;
  }

  digitos = digitos.slice(0, 4);
  return digitos.length < 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}
