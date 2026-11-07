/**
 * Calendarios de vacunación de referencia. ORIENTATIVOS: no reemplazan al carnet ni a la indicación médica.
 *
 * - Argentina: Calendario Nacional de Vacunación (Ministerio de Salud de la Nación), páginas por etapa de vida.
 * - Resto del mundo: referencia internacional armada con los resúmenes de rutina de la OMS y los calendarios de los CDC.
 *
 * Cada calendario lleva versión y fuentes para poder revisarlo/actualizarlo (los calendarios cambian).
 */

export interface ScheduleDose {
  /** Edad recomendada en meses desde el nacimiento */
  ageMonths: number
  label: string
}

export interface ScheduleVaccine {
  id: string
  name: string
  prevents: string
  /** Textos (sin tildes, minúsculas) con los que se reconoce el nombre de una vacuna ya cargada */
  match: RegExp
  doses: ScheduleDose[]
  /** Vacunas de adultos/refuerzos periódicos: se evalúan también después de los 18 años */
  adult?: boolean
  /** Refuerzo periódico: años desde la última dosis */
  repeatYears?: number
  /** Solo en ciertas situaciones (zona de riesgo, factores de riesgo): se muestra aparte y no cuenta como pendiente */
  condition?: string
  note?: string
}

export interface VaccineSchedule {
  id: 'AR' | 'INTL'
  title: string
  country: string
  /** Fecha en la que se revisó contra las fuentes (YYYY-MM-DD) */
  reviewedAt: string
  sources: { label: string; url: string }[]
  disclaimer: string
  vaccines: ScheduleVaccine[]
}

const AR: VaccineSchedule = {
  id: 'AR',
  title: 'Calendario Nacional de Vacunación (Argentina)',
  country: 'Argentina',
  reviewedAt: '2026-11-07',
  sources: [
    { label: 'Hasta un año', url: 'https://www.argentina.gob.ar/salud/vacunas/vacunacion-lactantes' },
    { label: 'Hasta 2 años', url: 'https://www.argentina.gob.ar/salud/vacunas/vacunacion-niniosyninias' },
    { label: 'Ingreso escolar (5 años)', url: 'https://www.argentina.gob.ar/salud/vacunas/ingresoescolar' },
    { label: '11 años', url: 'https://www.argentina.gob.ar/salud/vacunas/vacunacion-adolescentes' },
    { label: '15 a 64 años', url: 'https://www.argentina.gob.ar/salud/vacunas/vacunacion-adultos' },
    { label: '65 años o más', url: 'https://www.argentina.gob.ar/salud/vacunas/vacunacion-adultosmayores' },
    { label: 'Embarazo', url: 'https://www.argentina.gob.ar/salud/vacunas/embarazadas' },
  ],
  disclaimer: 'Orientativo, según el sitio del Ministerio de Salud de la Nación. Puede haber cambios recientes: confirmalo en tu vacunatorio.',
  vaccines: [
    { id: 'bcg', name: 'BCG (tuberculosis)', prevents: 'Tuberculosis', match: /\bbcg\b|tuberculosis/, doses: [{ ageMonths: 0, label: 'Única dosis (recién nacido)' }] },
    { id: 'hepb', name: 'Hepatitis B', prevents: 'Hepatitis B', match: /hepatitis b|\bhep b\b|\bhb\b/, doses: [{ ageMonths: 0, label: 'Dosis neonatal (primeras 12 horas)' }] },
    {
      id: 'neumo', name: 'Neumococo conjugada', prevents: 'Neumonía y meningitis por neumococo', match: /neumococ|prevenar|\bvcn\b/,
      doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 12, label: 'Refuerzo' }],
    },
    {
      id: 'polio', name: 'Polio (IPV / Salk)', prevents: 'Poliomielitis', match: /polio|\bipv\b|\bsalk\b|sabin/,
      doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 6, label: '3ª dosis' }, { ageMonths: 60, label: 'Refuerzo (ingreso escolar)' }],
    },
    {
      id: 'quintuple', name: 'Quíntuple (pentavalente)', prevents: 'Difteria, tétanos, tos convulsa, hepatitis B y Hib', match: /quintuple|pentavalente/,
      doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 6, label: '3ª dosis' }, { ageMonths: 15, label: 'Refuerzo (15 a 18 meses)' }],
    },
    { id: 'rota', name: 'Rotavirus', prevents: 'Diarrea grave por rotavirus', match: /rotavirus/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }] },
    {
      id: 'mening', name: 'Meningococo', prevents: 'Meningitis y sepsis por meningococo', match: /meningococ|menacwy|\bmen\b/,
      doses: [{ ageMonths: 3, label: '1ª dosis' }, { ageMonths: 5, label: '2ª dosis' }, { ageMonths: 15, label: 'Refuerzo' }, { ageMonths: 132, label: 'Dosis única (11 años)' }],
    },
    { id: 'hepa', name: 'Hepatitis A', prevents: 'Hepatitis A', match: /hepatitis a|\bhep a\b/, doses: [{ ageMonths: 12, label: 'Dosis única' }] },
    {
      id: 'triple-viral', name: 'Triple viral (SRP)', prevents: 'Sarampión, rubéola y paperas', match: /triple viral|\bsrp\b|sarampion|\bmmr\b/,
      doses: [{ ageMonths: 12, label: '1ª dosis' }, { ageMonths: 15, label: '2ª dosis (15 a 18 meses)' }],
      note: 'Desde los 5 años toda persona debe acreditar 2 dosis aplicadas después del año de vida.',
    },
    { id: 'varicela', name: 'Varicela', prevents: 'Varicela', match: /varicela/, doses: [{ ageMonths: 15, label: '1ª dosis' }, { ageMonths: 60, label: '2ª dosis (ingreso escolar)' }] },
    { id: 'dtp', name: 'Triple bacteriana celular (DTP)', prevents: 'Difteria, tétanos y tos convulsa', match: /triple bacteriana celular|\bdtp\b|(?<!a)celular/, doses: [{ ageMonths: 60, label: 'Refuerzo (ingreso escolar)' }] },
    { id: 'hpv', name: 'VPH', prevents: 'Virus del papiloma humano', match: /\bvph\b|\bhpv\b|papiloma/, doses: [{ ageMonths: 132, label: 'Dosis única (11 años)' }] },
    { id: 'dtpa', name: 'Triple bacteriana acelular (dTpa)', prevents: 'Difteria, tétanos y tos convulsa', match: /acelular|\bdtpa\b|\btdap\b/, doses: [{ ageMonths: 132, label: 'Dosis única (11 años)' }] },
    {
      id: 'td', name: 'Doble bacteriana (dT)', prevents: 'Difteria y tétanos', match: /doble bacteriana|\bdt\b|\btd\b|antitetanic/, adult: true, repeatYears: 10,
      doses: [{ ageMonths: 180, label: 'Iniciar o completar esquema de 3 dosis' }],
      note: 'Completado el esquema, un refuerzo cada 10 años.',
    },
    {
      id: 'neumo65', name: 'Neumococo (VCN20)', prevents: 'Neumonía por neumococo', match: /neumococ|\bvcn\b/, adult: true,
      doses: [{ ageMonths: 780, label: 'Dosis única (65 años o más)' }],
    },
    { id: 'fiebre-amarilla', name: 'Fiebre amarilla', prevents: 'Fiebre amarilla', match: /fiebre amarilla/, condition: 'Solo si residís o viajás a zonas de riesgo (1ª dosis a los 18 meses, refuerzo a los 11 años).', doses: [{ ageMonths: 18, label: '1ª dosis' }, { ageMonths: 132, label: 'Refuerzo' }] },
    { id: 'fha', name: 'Fiebre hemorrágica argentina', prevents: 'Fiebre hemorrágica argentina', match: /fiebre hemorragica|\bfha\b/, condition: 'Desde los 15 años, si residís o trabajás en la zona endémica (Buenos Aires, Córdoba, Santa Fe y La Pampa).', doses: [{ ageMonths: 180, label: 'Dosis única' }] },
    { id: 'gripe', name: 'Antigripal', prevents: 'Gripe (influenza)', match: /antigripal|gripe|influenza/, condition: 'Dosis anual en embarazo, desde los 65 años, de 6 a 24 meses (2 dosis) y personas con factores de riesgo.', doses: [{ ageMonths: 6, label: 'Dosis anual' }] },
    { id: 'vsr', name: 'Virus sincicial respiratorio (VSR)', prevents: 'Bronquiolitis del recién nacido', match: /sincicial|\bvsr\b|\brsv\b/, condition: 'Una dosis en cada embarazo, entre las semanas 32 y 36,6.', doses: [{ ageMonths: 216, label: 'Dosis en el embarazo' }] },
  ],
}

const INTL: VaccineSchedule = {
  id: 'INTL',
  title: 'Referencia internacional (OMS / CDC)',
  country: 'Resto del mundo',
  reviewedAt: '2026-11-07',
  sources: [
    { label: 'OMS · Recomendaciones de inmunización de rutina', url: 'https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables' },
    { label: 'CDC · Niños y adolescentes', url: 'https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html' },
    { label: 'CDC · Adultos', url: 'https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html' },
  ],
  disclaimer: 'Referencia general: cada país tiene su propio calendario nacional y las edades pueden variar. Consultá el de tu país y a tu médico.',
  vaccines: [
    { id: 'bcg', name: 'BCG (tuberculosis)', prevents: 'Tuberculosis', match: /\bbcg\b|tuberculosis/, condition: 'En países con alta carga de tuberculosis, al nacer.', doses: [{ ageMonths: 0, label: 'Una dosis al nacer' }] },
    { id: 'hepb', name: 'Hepatitis B', prevents: 'Hepatitis B', match: /hepatitis b|\bhep b\b|\bhb\b/, doses: [{ ageMonths: 0, label: 'Al nacer' }, { ageMonths: 2, label: '2ª dosis' }, { ageMonths: 6, label: '3ª dosis' }] },
    { id: 'dtp', name: 'DTP / DTaP (difteria, tétanos, tos convulsa)', prevents: 'Difteria, tétanos y tos convulsa', match: /dtp|dtap|dtpa|quintuple|pentavalente|hexavalente|triple bacteriana/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 6, label: '3ª dosis' }, { ageMonths: 15, label: 'Refuerzo (12 a 18 meses)' }, { ageMonths: 60, label: 'Refuerzo (4 a 6 años)' }] },
    { id: 'hib', name: 'Hib (Haemophilus influenzae b)', prevents: 'Meningitis y neumonía por Hib', match: /\bhib\b|haemophilus|quintuple|pentavalente|hexavalente/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 12, label: 'Refuerzo (12 a 15 meses)' }] },
    { id: 'polio', name: 'Polio', prevents: 'Poliomielitis', match: /polio|\bipv\b|\bopv\b|salk|sabin/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 6, label: '3ª dosis' }, { ageMonths: 60, label: 'Refuerzo (4 a 6 años)' }] },
    { id: 'neumo', name: 'Neumococo conjugada', prevents: 'Neumonía y meningitis por neumococo', match: /neumococ|pneumococ|prevenar|\bpcv/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }, { ageMonths: 12, label: 'Refuerzo (12 a 15 meses)' }] },
    { id: 'rota', name: 'Rotavirus', prevents: 'Diarrea grave por rotavirus', match: /rotavirus/, doses: [{ ageMonths: 2, label: '1ª dosis' }, { ageMonths: 4, label: '2ª dosis' }] },
    { id: 'mmr', name: 'Sarampión, rubéola y paperas (SRP / MMR)', prevents: 'Sarampión, rubéola y paperas', match: /triple viral|\bsrp\b|\bmmr\b|sarampion/, doses: [{ ageMonths: 12, label: '1ª dosis (12 a 15 meses)' }, { ageMonths: 60, label: '2ª dosis (4 a 6 años)' }] },
    { id: 'varicela', name: 'Varicela', prevents: 'Varicela', match: /varicela/, doses: [{ ageMonths: 12, label: '1ª dosis (12 a 15 meses)' }, { ageMonths: 60, label: '2ª dosis (4 a 6 años)' }] },
    { id: 'hepa', name: 'Hepatitis A', prevents: 'Hepatitis A', match: /hepatitis a|\bhep a\b/, doses: [{ ageMonths: 12, label: '1ª dosis' }, { ageMonths: 18, label: '2ª dosis (6 meses después)' }] },
    { id: 'tdap', name: 'Tdap (refuerzo adolescente)', prevents: 'Tétanos, difteria y tos convulsa', match: /tdap|dtpa|acelular/, doses: [{ ageMonths: 132, label: 'Dosis a los 11 a 12 años' }] },
    { id: 'hpv', name: 'VPH', prevents: 'Virus del papiloma humano', match: /\bvph\b|\bhpv\b|papiloma/, doses: [{ ageMonths: 132, label: '1ª dosis (9 a 14 años)' }, { ageMonths: 138, label: '2ª dosis (6 a 12 meses después)' }] },
    { id: 'menacwy', name: 'Meningococo ACWY', prevents: 'Meningitis y sepsis por meningococo', match: /meningococ|menacwy|\bmen\b/, doses: [{ ageMonths: 132, label: '1ª dosis (11 a 12 años)' }, { ageMonths: 192, label: 'Refuerzo (16 años)' }] },
    { id: 'td', name: 'Td / Tdap (adultos)', prevents: 'Tétanos y difteria', match: /\btd\b|tdap|dtpa|doble bacteriana|antitetanic/, adult: true, repeatYears: 10, doses: [{ ageMonths: 228, label: 'Refuerzo' }], note: 'Un refuerzo cada 10 años.' },
    { id: 'gripe', name: 'Gripe (influenza)', prevents: 'Gripe', match: /antigripal|gripe|influenza/, condition: 'Dosis anual recomendada desde los 6 meses, en especial en embarazo, mayores de 65 años y personas con factores de riesgo.', doses: [{ ageMonths: 6, label: 'Dosis anual' }] },
    { id: 'zoster', name: 'Herpes zóster', prevents: 'Herpes zóster (culebrilla)', match: /zoster|culebrilla|shingrix/, condition: 'Recomendada desde los 50 años (2 dosis).', doses: [{ ageMonths: 600, label: '2 dosis' }] },
    { id: 'neumo-adulto', name: 'Neumococo (adultos)', prevents: 'Neumonía por neumococo', match: /neumococ|pneumococ|\bpcv/, condition: 'Recomendada desde los 50 a 65 años según el país.', doses: [{ ageMonths: 780, label: '1 dosis' }] },
  ],
}

export const VACCINE_SCHEDULES: Record<'AR' | 'INTL', VaccineSchedule> = { AR, INTL }

/** Calendario que corresponde al país del perfil (Argentina → Nacional; el resto → referencia OMS/CDC). */
export function scheduleForCountry(countryCode?: string, country?: string): VaccineSchedule {
  const code = (countryCode ?? '').trim().toUpperCase()
  const name = (country ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return code === 'AR' || name === 'argentina' ? AR : INTL
}
