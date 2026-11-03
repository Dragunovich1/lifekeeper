/**
 * Datos de lugares para el autocompletado (países, provincias/estados y ciudades principales).
 * Todo funciona SIN internet; las ciudades chicas se completan con la búsqueda del servidor (ver services/api/geocode.ts).
 */

/** Minúsculas, sin tildes ni signos, para comparar "cordoba" con "Córdoba". */
export const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export interface Country {
  code: string
  name: string
}

const CODES =
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  )

/** Cómo la gente escribe algunos países (siglas y nombres coloquiales). */
const ALIASES: Record<string, string> = {
  eeuu: 'US', usa: 'US', 'estados unidos de america': 'US', 'ee uu': 'US', uk: 'GB', inglaterra: 'GB', 'gran bretana': 'GB', escocia: 'GB',
  holanda: 'NL', 'paises bajos': 'NL', 'rep dominicana': 'DO', rusia: 'RU', chequia: 'CZ', 'republica checa': 'CZ', corea: 'KR', birmania: 'MM',
}

let cache: Country[] | null = null

export function getCountries(): Country[] {
  if (cache) return cache
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(['es'], { type: 'region' })
  } catch {
    names = null
  }
  cache = CODES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return cache
}

export const countryByCode = (code?: string): Country | undefined => (code ? getCountries().find((c) => c.code === code.toUpperCase()) : undefined)

/** País cuyo nombre coincide exactamente (sin tildes ni mayúsculas) con el texto, si lo hay. */
export function matchCountry(text: string): Country | undefined {
  const q = norm(text)
  if (!q) return undefined
  const aliased = ALIASES[q]
  if (aliased) return countryByCode(aliased)
  return getCountries().find((c) => norm(c.name) === q || c.code.toLowerCase() === q)
}

const POPULAR = ['AR', 'UY', 'CL', 'PY', 'BO', 'BR', 'PE', 'CO', 'MX', 'ES', 'US']

/** Más chico = más común en la región (desempata sugerencias: "arg" → Argentina antes que Argelia). */
const popularity = (code: string) => {
  const i = POPULAR.indexOf(code)
  return i === -1 ? 99 : i
}

function rank(candidate: string, q: string): number {
  const c = norm(candidate)
  if (c === q) return 0
  if (c.startsWith(q)) return 1
  if (c.split(' ').some((w) => w.startsWith(q))) return 2
  if (c.includes(q)) return 3
  return -1
}

/** Países que coinciden con lo escrito (por nombre, sigla o apodo). Sin texto: los más comunes en la región. */
export function searchCountries(text: string, limit = 8): Country[] {
  const q = norm(text)
  if (!q) return POPULAR.map((c) => countryByCode(c)!).filter(Boolean)
  const aliasHit = ALIASES[q] ? countryByCode(ALIASES[q]) : undefined
  const scored = getCountries()
    .map((c) => {
      const r = Math.min(...[rank(c.name, q), c.code.toLowerCase() === q ? 0 : -1].filter((x) => x >= 0).concat(99))
      return { c, r }
    })
    .filter((x) => x.r < 99)
    .sort((a, b) => a.r - b.r || popularity(a.c.code) - popularity(b.c.code) || a.c.name.localeCompare(b.c.name, 'es'))
    .map((x) => x.c)
  return [...(aliasHit ? [aliasHit] : []), ...scored.filter((c) => c.code !== aliasHit?.code)].slice(0, limit)
}

/** Primer nivel administrativo (provincias, estados, departamentos, regiones) de los países más usados. */
export const REGIONS: Record<string, string[]> = {
  AR: ['Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'],
  UY: ['Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida', 'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'],
  CL: ['Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana de Santiago', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'],
  PY: ['Asunción', 'Alto Paraguay', 'Alto Paraná', 'Amambay', 'Boquerón', 'Caaguazú', 'Caazapá', 'Canindeyú', 'Central', 'Concepción', 'Cordillera', 'Guairá', 'Itapúa', 'Misiones', 'Ñeembucú', 'Paraguarí', 'Presidente Hayes', 'San Pedro'],
  BO: ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija'],
  PE: ['Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'],
  CO: ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'],
  BR: ['Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahía', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Río de Janeiro', 'Río Grande do Norte', 'Río Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'],
  MX: ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'],
  ES: ['Andalucía', 'Aragón', 'Asturias', 'Islas Baleares', 'Canarias', 'Cantabria', 'Castilla y León', 'Castilla-La Mancha', 'Cataluña', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Ceuta', 'Melilla'],
  US: ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Carolina del Norte', 'Carolina del Sur', 'Colorado', 'Connecticut', 'Dakota del Norte', 'Dakota del Sur', 'Delaware', 'Distrito de Columbia', 'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Luisiana', 'Maine', 'Maryland', 'Massachusetts', 'Míchigan', 'Minnesota', 'Misisipi', 'Misuri', 'Montana', 'Nebraska', 'Nevada', 'Nueva Hampshire', 'Nueva Jersey', 'Nueva York', 'Nuevo México', 'Ohio', 'Oklahoma', 'Oregón', 'Pensilvania', 'Rhode Island', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Virginia Occidental', 'Washington', 'Wisconsin', 'Wyoming'],
}

export const regionsFor = (countryCode?: string): string[] => (countryCode ? REGIONS[countryCode.toUpperCase()] ?? [] : [])

/** Texto → provincia/estado exacto del país (sin tildes ni mayúsculas). */
export function matchRegion(countryCode: string | undefined, text: string): string | undefined {
  const q = norm(text)
  if (!q) return undefined
  const aliases: Record<string, string> = { caba: 'Ciudad Autónoma de Buenos Aires', 'capital federal': 'Ciudad Autónoma de Buenos Aires', 'bs as': 'Buenos Aires', bsas: 'Buenos Aires', 'pcia de buenos aires': 'Buenos Aires', 'provincia de buenos aires': 'Buenos Aires' }
  if (countryCode?.toUpperCase() === 'AR' && aliases[q]) return aliases[q]
  return regionsFor(countryCode).find((r) => norm(r) === q)
}

export function searchRegions(countryCode: string | undefined, text: string, limit = 10): string[] {
  const list = regionsFor(countryCode)
  const q = norm(text)
  if (!q) return list.slice(0, limit)
  const alias = matchRegion(countryCode, text)
  const scored = list.map((r) => ({ r, s: rank(r, q) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.r.localeCompare(b.r, 'es')).map((x) => x.r)
  return [...(alias ? [alias] : []), ...scored.filter((r) => r !== alias)].slice(0, limit)
}

export interface PlaceHit {
  name: string
  admin1?: string
  country: string
  countryCode: string
  latitude?: number
  longitude?: number
}

/** Ciudades principales (respaldo sin conexión). Formato: "Ciudad|Provincia o estado|País". */
const OFFLINE = `Ciudad Autónoma de Buenos Aires|Ciudad Autónoma de Buenos Aires|AR
La Plata|Buenos Aires|AR;Mar del Plata|Buenos Aires|AR;Bahía Blanca|Buenos Aires|AR;Quilmes|Buenos Aires|AR;Lanús|Buenos Aires|AR;Monte Chingolo|Buenos Aires|AR;Avellaneda|Buenos Aires|AR;Lomas de Zamora|Buenos Aires|AR;Banfield|Buenos Aires|AR;Temperley|Buenos Aires|AR;Adrogué|Buenos Aires|AR;Berazategui|Buenos Aires|AR;Florencio Varela|Buenos Aires|AR;Almirante Brown|Buenos Aires|AR;Esteban Echeverría|Buenos Aires|AR;Ezeiza|Buenos Aires|AR;San Isidro|Buenos Aires|AR;Vicente López|Buenos Aires|AR;San Martín|Buenos Aires|AR;Tres de Febrero|Buenos Aires|AR;Morón|Buenos Aires|AR;Merlo|Buenos Aires|AR;Moreno|Buenos Aires|AR;La Matanza|Buenos Aires|AR;Tigre|Buenos Aires|AR;Pilar|Buenos Aires|AR;Escobar|Buenos Aires|AR;Lomas del Mirador|Buenos Aires|AR;San Miguel|Buenos Aires|AR;José C. Paz|Buenos Aires|AR;Tandil|Buenos Aires|AR;Olavarría|Buenos Aires|AR;Junín|Buenos Aires|AR;Pergamino|Buenos Aires|AR;Zárate|Buenos Aires|AR;Campana|Buenos Aires|AR;Luján|Buenos Aires|AR;San Nicolás de los Arroyos|Buenos Aires|AR;Necochea|Buenos Aires|AR;Azul|Buenos Aires|AR;Chivilcoy|Buenos Aires|AR
Córdoba|Córdoba|AR;Río Cuarto|Córdoba|AR;Villa María|Córdoba|AR;Villa Carlos Paz|Córdoba|AR;San Francisco|Córdoba|AR;Alta Gracia|Córdoba|AR
Rosario|Santa Fe|AR;Santa Fe|Santa Fe|AR;Rafaela|Santa Fe|AR;Venado Tuerto|Santa Fe|AR;Reconquista|Santa Fe|AR
Mendoza|Mendoza|AR;San Rafael|Mendoza|AR;Godoy Cruz|Mendoza|AR
San Miguel de Tucumán|Tucumán|AR;Salta|Salta|AR;San Salvador de Jujuy|Jujuy|AR;Santiago del Estero|Santiago del Estero|AR;Resistencia|Chaco|AR;Corrientes|Corrientes|AR;Posadas|Misiones|AR;Formosa|Formosa|AR
Paraná|Entre Ríos|AR;Concordia|Entre Ríos|AR;Gualeguaychú|Entre Ríos|AR
Neuquén|Neuquén|AR;Cipolletti|Río Negro|AR;San Carlos de Bariloche|Río Negro|AR;Viedma|Río Negro|AR;General Roca|Río Negro|AR
Comodoro Rivadavia|Chubut|AR;Trelew|Chubut|AR;Puerto Madryn|Chubut|AR;Río Gallegos|Santa Cruz|AR;Ushuaia|Tierra del Fuego|AR;Río Grande|Tierra del Fuego|AR
San Juan|San Juan|AR;San Luis|San Luis|AR;Santa Rosa|La Pampa|AR;La Rioja|La Rioja|AR;San Fernando del Valle de Catamarca|Catamarca|AR
Montevideo|Montevideo|UY;Punta del Este|Maldonado|UY;Salto|Salto|UY;Colonia del Sacramento|Colonia|UY
Santiago|Metropolitana de Santiago|CL;Valparaíso|Valparaíso|CL;Viña del Mar|Valparaíso|CL;Concepción|Biobío|CL;Antofagasta|Antofagasta|CL
Asunción|Asunción|PY;Ciudad del Este|Alto Paraná|PY;Encarnación|Itapúa|PY
La Paz|La Paz|BO;Santa Cruz de la Sierra|Santa Cruz|BO;Cochabamba|Cochabamba|BO
Lima|Lima|PE;Arequipa|Arequipa|PE;Cusco|Cusco|PE
Bogotá|Bogotá D.C.|CO;Medellín|Antioquia|CO;Cali|Valle del Cauca|CO;Barranquilla|Atlántico|CO
São Paulo|São Paulo|BR;Río de Janeiro|Río de Janeiro|BR;Brasilia|Distrito Federal|BR;Porto Alegre|Río Grande do Sul|BR;Florianópolis|Santa Catarina|BR
Ciudad de México|Ciudad de México|MX;Guadalajara|Jalisco|MX;Monterrey|Nuevo León|MX;Cancún|Quintana Roo|MX
Madrid|Madrid|ES;Barcelona|Cataluña|ES;Valencia|Comunidad Valenciana|ES;Sevilla|Andalucía|ES
Nueva York|Nueva York|US;Los Ángeles|California|US;Miami|Florida|US;Chicago|Illinois|US;Houston|Texas|US`

let offlineCache: PlaceHit[] | null = null
function offlinePlaces(): PlaceHit[] {
  if (offlineCache) return offlineCache
  offlineCache = OFFLINE.split(/[;\n]/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [name, admin1, code] = row.split('|')
      return { name, admin1, countryCode: code, country: countryByCode(code)?.name ?? code }
    })
  return offlineCache
}

/** Ciudades de la lista local que coinciden (sin conexión). Si hay país elegido, solo de ese país. */
export function searchOfflinePlaces(text: string, opts: { countryCode?: string; admin1?: string; limit?: number } = {}): PlaceHit[] {
  const q = norm(text)
  if (q.length < 2) return []
  const adm = opts.admin1 ? norm(opts.admin1) : ''
  return offlinePlaces()
    .filter((p) => !opts.countryCode || p.countryCode === opts.countryCode.toUpperCase())
    .map((p) => ({ p, s: rank(p.name, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => (adm && norm(a.p.admin1 ?? '') === adm ? -1 : 0) - (adm && norm(b.p.admin1 ?? '') === adm ? -1 : 0) || a.s - b.s || a.p.name.localeCompare(b.p.name, 'es'))
    .map((x) => x.p)
    .slice(0, opts.limit ?? 6)
}
