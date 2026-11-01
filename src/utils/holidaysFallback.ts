/**
 * Feriados nacionales de Argentina con fecha fija ("inamovibles"). Se usan solo si no hay conexión
 * ni copia guardada de los feriados reales; los trasladables y los puentes no se pueden calcular acá.
 */
export interface Holiday {
  date: string
  name: string
  type?: string
}

const FIXED: [string, string][] = [
  ['01-01', 'Año Nuevo'],
  ['03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'],
  ['04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
  ['05-01', 'Día del Trabajador'],
  ['05-25', 'Día de la Revolución de Mayo'],
  ['06-20', 'Paso a la Inmortalidad del General Manuel Belgrano'],
  ['07-09', 'Día de la Independencia'],
  ['12-08', 'Inmaculada Concepción de María'],
  ['12-25', 'Navidad'],
]

export const fixedHolidays = (year: number): Holiday[] => FIXED.map(([md, name]) => ({ date: `${year}-${md}`, name, type: 'inamovible' }))
