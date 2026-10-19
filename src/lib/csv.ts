/**
 * Excel y Sheets ejecutan como fórmula lo que empieza con = + - @ (o tab / retorno).
 * Las respuestas abiertas de la encuesta web las escribe cualquiera, así que el
 * texto libre se prefija con ' para que llegue como texto y no como fórmula.
 * Solo para texto: los números de la base no pasan por acá.
 */
export function neutralizeFormula(value: string | null | undefined) {
  const s = value ?? "";
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
