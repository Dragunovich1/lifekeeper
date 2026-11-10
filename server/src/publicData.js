/**
 * Datos públicos de uso libre, servidos por el propio backend de LifeKeeper:
 *  - Feriados de Argentina (ArgentinaDatos)
 *  - Inflación / IPC del INDEC (API de Series de Tiempo de datos.gob.ar, con ArgentinaDatos de respaldo)
 *  - Catálogo de ejercicios (wger)
 *  - Información de salud en español (MedlinePlus, de la Biblioteca Nacional de Medicina de EE.UU.)
 *  - Búsqueda de ciudades para el autocompletado de ubicación (geocodificación abierta de Open-Meteo / GeoNames)
 *
 * Por qué pasa por el servidor y no directo desde el navegador:
 *  - Privacidad: la IP del usuario no llega a cada API externa y no se envía ningún dato personal.
 *  - Sin problemas de CORS (clave en la APK de Android).
 *  - Caché: se respetan los límites de cada servicio y la app sigue andando si el servicio cae
 *    (se sirve la última copia buena marcada como `stale`).
 *
 * Solo lectura. Nunca recibe datos de la bóveda.
 */

import { Router } from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UA = 'LifeKeeper/1.0 (bóveda personal auto-hospedada)'
const HOUR = 3600_000
const DAY = 24 * HOUR

const IPC_SERIES_ID = process.env.PUBLIC_IPC_SERIES_ID || '148.3_INIVELNAL_DICI_M_26'

/** Nombres de principios activos que en Argentina se dicen distinto que en la nomenclatura de EE.UU. (RxNorm). */
const DRUG_ALIASES = {
  paracetamol: 'acetaminophen',
  salbutamol: 'albuterol',
  amoxicilina: 'amoxicillin',
  ibuprofeno: 'ibuprofen',
  omeprazol: 'omeprazole',
  losartan: 'losartan',
  levotiroxina: 'levothyroxine',
  atorvastatina: 'atorvastatin',
  sertralina: 'sertraline',
  enalapril: 'enalapril',
  loratadina: 'loratadine',
  cetirizina: 'cetirizine',
  aspirina: 'aspirin',
  'acido acetilsalicilico': 'aspirin',
  diclofenac: 'diclofenac',
  metformina: 'metformin',
  clonazepam: 'clonazepam',
  alprazolam: 'alprazolam',
  amlodipina: 'amlodipine',
  simvastatina: 'simvastatin',
  rosuvastatina: 'rosuvastatin',
  ranitidina: 'ranitidine',
  azitromicina: 'azithromycin',
  ciprofloxacina: 'ciprofloxacin',
  prednisona: 'prednisone',
  naproxeno: 'naproxen',
  warfarina: 'warfarin',
  insulina: 'insulin',
  furosemida: 'furosemide',
  bisoprolol: 'bisoprolol',
  carvedilol: 'carvedilol',
  fluoxetina: 'fluoxetine',
  escitalopram: 'escitalopram',
  tramadol: 'tramadol',
  diazepam: 'diazepam',
  lorazepam: 'lorazepam',
  ketorolac: 'ketorolac',
  ketorolaco: 'ketorolac',
  dexametasona: 'dexamethasone',
  budesonida: 'budesonide',
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
export const normalize = (s) => stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()

const NAMED_ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿', ndash: '–', mdash: '—', hellip: '…', bull: '•',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', deg: '°', micro: 'µ', plusmn: '±', copy: '©', reg: '®', trade: '™',
  agrave: 'à', egrave: 'è', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô', auml: 'ä', ouml: 'ö',
}

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (whole, name) => (name === 'amp' ? whole : NAMED_ENTITIES[name] ?? whole))
    .replace(/&amp;/g, '&')
}

const BLOCK_TAGS = /<\/?(?:p|br|li|ul|ol|div|h[1-6]|tr|td|th|table|section|article)\b[^>]*>/gi

/** Quita etiquetas HTML (también las escapadas) y normaliza espacios. Las etiquetas en línea no dejan espacios de más. */
export function toPlainText(html) {
  const strip = (t) => t.replace(BLOCK_TAGS, ' ').replace(/<[^>]*>/g, '')
  // El contenido puede venir con etiquetas literales o escapadas (&lt;p&gt;), a veces dos veces
  let out = strip(String(html ?? ''))
  out = strip(decodeEntities(out))
  out = strip(decodeEntities(out))
  return decodeEntities(out).replace(/\s+/g, ' ').replace(/\s+([.,;:!?)])/g, '$1').trim()
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export function createPublicDataRouter({ fetchImpl = globalThis.fetch, cacheFile = path.join(os.tmpdir(), 'lifekeeper-wger-catalog.json'), preloadExercises = true } = {}) {
  const router = Router()
  const cache = new Map()

  async function getResponse(url, { timeout = 9000, accept = 'application/json' } = {}) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(timeout) })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`)
    return res
  }
  const getJson = async (url, opts) => (await getResponse(url, opts)).json()
  const getText = async (url, opts) => (await getResponse(url, { accept: 'application/xml,text/xml,*/*', ...opts })).text()

  /** Devuelve la copia fresca o la recalcula; si falla, entrega la última copia buena marcada como vencida. */
  async function cached(key, ttl, loader) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return { value: hit.value, stale: false }
    try {
      const value = await loader()
      cache.set(key, { value, at: Date.now() })
      return { value, stale: false }
    } catch (err) {
      if (hit) return { value: hit.value, stale: true }
      throw err
    }
  }

  const fail = (res, err) => res.status(502).json({ error: 'No se pudo consultar la fuente de datos', detail: String(err?.message ?? err) })

  // -------------------------------------------------------------------------
  // Feriados
  // -------------------------------------------------------------------------
  router.get('/holidays', async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear()
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ error: 'Año inválido' })
    try {
      const { value, stale } = await cached(`holidays:${year}`, 7 * DAY, async () => {
        const raw = await getJson(`https://api.argentinadatos.com/v1/feriados/${year}`)
        const list = Array.isArray(raw) ? raw : []
        return list
          .map((h) => ({ date: String(h.fecha ?? h.date ?? ''), name: String(h.nombre ?? h.name ?? '').trim(), type: String(h.tipo ?? h.type ?? '') }))
          .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name)
          .sort((a, b) => a.date.localeCompare(b.date))
      })
      res.json({ year, source: 'ArgentinaDatos', holidays: value, stale })
    } catch (err) {
      fail(res, err)
    }
  })

  // -------------------------------------------------------------------------
  // Inflación
  // -------------------------------------------------------------------------
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

  /** Serie de índice (nivel) → variación mensual e interanual. */
  function fromIndexLevels(rows) {
    const levels = rows
      .map(([date, value]) => ({ month: String(date).slice(0, 7), value: Number(value) }))
      .filter((r) => /^\d{4}-\d{2}$/.test(r.month) && Number.isFinite(r.value) && r.value > 0)
      .sort((a, b) => a.month.localeCompare(b.month))
    return levels.map((r, i) => ({
      month: r.month,
      monthly: i > 0 ? round((r.value / levels[i - 1].value - 1) * 100) : null,
      yoy: i >= 12 ? round((r.value / levels[i - 12].value - 1) * 100) : null,
    }))
  }

  /** Serie de variación mensual (%) → interanual por capitalización de 12 meses. */
  function fromMonthlyRates(rows) {
    const rates = rows
      .map((r) => ({ month: String(r.fecha ?? r.date ?? '').slice(0, 7), value: Number(r.valor ?? r.value) }))
      .filter((r) => /^\d{4}-\d{2}$/.test(r.month) && Number.isFinite(r.value))
      .sort((a, b) => a.month.localeCompare(b.month))
    return rates.map((r, i) => ({
      month: r.month,
      monthly: round(r.value),
      yoy: i >= 11 ? round((rates.slice(i - 11, i + 1).reduce((acc, x) => acc * (1 + x.value / 100), 1) - 1) * 100) : null,
    }))
  }

  router.get('/inflation', async (req, res) => {
    const months = Math.min(60, Math.max(3, Number(req.query.months) || 24))
    try {
      const { value, stale } = await cached(`inflation:${months}`, 12 * HOUR, async () => {
        let source = 'INDEC (datos.gob.ar)'
        let series
        try {
          const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(IPC_SERIES_ID)}&format=json&limit=${months + 12}&sort=desc`
          const raw = await getJson(url)
          if (!Array.isArray(raw?.data) || raw.data.length < 3) throw new Error('Serie vacía')
          series = fromIndexLevels(raw.data)
        } catch {
          source = 'ArgentinaDatos (INDEC)'
          const raw = await getJson('https://api.argentinadatos.com/v1/finanzas/indices/inflacion')
          if (!Array.isArray(raw) || raw.length < 3) throw new Error('Inflación no disponible')
          series = fromMonthlyRates(raw)
        }
        series = series.slice(-months)
        return { source, series, latest: series[series.length - 1] ?? null }
      })
      res.json({ ...value, stale })
    } catch (err) {
      fail(res, err)
    }
  })

  // -------------------------------------------------------------------------
  // Ejercicios (wger)
  // -------------------------------------------------------------------------
  const WGER = 'https://wger.de/api/v2'
  const catalog = { ready: false, loading: false, items: [], at: 0, lang: 'es', error: '' }

  const nameOf = (obj) => String(obj?.name_en || obj?.name || '').trim()
  const pickTranslation = (translations, langIds) => {
    for (const id of langIds) {
      const t = translations.find((x) => Number(x.language?.id ?? x.language) === id && String(x.name ?? '').trim())
      if (t) return t
    }
    return null
  }

  function normalizeExercise(raw, esId, enId) {
    const translations = Array.isArray(raw.translations) ? raw.translations : []
    let name = ''
    let nameEn = ''
    let lang = 'es'
    if (translations.length) {
      const es = pickTranslation(translations, [esId])
      const en = pickTranslation(translations, [enId])
      name = es?.name ?? en?.name ?? translations[0]?.name ?? ''
      nameEn = en?.name ?? ''
      lang = es ? 'es' : 'en'
    } else {
      name = String(raw.name ?? '')
      nameEn = name
      lang = Number(raw.language) === esId ? 'es' : 'en'
    }
    name = String(name).trim()
    if (!name) return null
    const images = Array.isArray(raw.images) ? raw.images : []
    const main = images.find((i) => i.is_main) ?? images[0]
    return {
      id: raw.id,
      name,
      nameEn: String(nameEn).trim(),
      lang,
      category: String(raw.category?.name ?? '').trim(),
      muscles: (raw.muscles ?? []).map(nameOf).filter(Boolean),
      musclesSecondary: (raw.muscles_secondary ?? []).map(nameOf).filter(Boolean),
      equipment: (raw.equipment ?? []).map((e) => String(e?.name ?? '').trim()).filter(Boolean),
      image: main?.image ? String(main.image) : '',
    }
  }

  async function loadExerciseCatalog() {
    if (catalog.loading) return
    catalog.loading = true
    try {
      const langs = await getJson(`${WGER}/language/?limit=100`)
      const find = (code) => Number((langs.results ?? []).find((l) => String(l.short_name).toLowerCase() === code)?.id)
      const esId = find('es')
      const enId = find('en')
      const items = []
      let url = `${WGER}/exerciseinfo/?limit=100&offset=0`
      for (let page = 0; page < 40 && url; page++) {
        const data = await getJson(url, { timeout: 15000 })
        for (const raw of data.results ?? []) {
          const item = normalizeExercise(raw, esId, enId)
          if (item) items.push(item)
        }
        url = data.next ? String(data.next).replace(/^http:/, 'https:') : ''
      }
      if (items.length === 0) throw new Error('Catálogo vacío')
      catalog.items = items
      catalog.ready = true
      catalog.at = Date.now()
      catalog.error = ''
      try {
        fs.writeFileSync(cacheFile, JSON.stringify({ at: catalog.at, items }))
      } catch {
        /* sin disco: queda en memoria */
      }
    } catch (err) {
      catalog.error = String(err?.message ?? err)
    } finally {
      catalog.loading = false
    }
  }

  function bootCatalog() {
    try {
      const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (Array.isArray(saved.items) && saved.items.length) {
        catalog.items = saved.items
        catalog.ready = true
        catalog.at = saved.at ?? 0
      }
    } catch {
      /* primera vez */
    }
    if (!catalog.ready || Date.now() - catalog.at > 7 * DAY) setTimeout(() => void loadExerciseCatalog(), 3000).unref?.()
  }
  if (preloadExercises) bootCatalog()

  router.get('/exercises', (req, res) => {
    const q = normalize(String(req.query.q ?? '').slice(0, 60))
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12))
    if (!catalog.ready) {
      if (!catalog.loading) void loadExerciseCatalog()
      return res.json({ ready: false, loading: catalog.loading, error: catalog.error, total: 0, results: [] })
    }
    if (!q) return res.json({ ready: true, total: catalog.items.length, results: [] })
    const scored = []
    for (const item of catalog.items) {
      const names = [normalize(item.name), normalize(item.nameEn)]
      let score = -1
      if (names.some((n) => n === q)) score = 0
      else if (names.some((n) => n.startsWith(q))) score = 1
      else if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) score = 2
      else if (names.some((n) => n.includes(q))) score = 3
      if (score >= 0) scored.push({ score, item })
    }
    scored.sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length)
    res.json({ ready: true, total: catalog.items.length, results: scored.slice(0, limit).map((s) => s.item) })
  })

  router.get('/exercises/status', (_req, res) => {
    res.json({ ready: catalog.ready, loading: catalog.loading, total: catalog.items.length, updatedAt: catalog.at || null, error: catalog.error })
  })

  // -------------------------------------------------------------------------
  // MedlinePlus
  // -------------------------------------------------------------------------
  /** Lee los <document> del XML del servicio web de MedlinePlus. */
  function parseMedlineXml(xml) {
    const docs = []
    const docRx = /<document\b([^>]*)>([\s\S]*?)<\/document>/g
    let m
    while ((m = docRx.exec(xml))) {
      const url = (/url="([^"]*)"/.exec(m[1]) ?? [])[1] ?? ''
      const contents = {}
      const cRx = /<content\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/content>/g
      let c
      while ((c = cRx.exec(m[2]))) contents[c[1]] = (contents[c[1]] ? `${contents[c[1]]} ` : '') + c[2]
      const title = toPlainText(contents.title)
      if (!title) continue
      const summary = toPlainText(contents.FullSummary || contents.snippet || '')
      docs.push({ title, url: decodeEntities(url), summary: clip(summary, 700), group: toPlainText(contents.groupName) })
    }
    return docs
  }

  router.get('/medlineplus/topics', async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 80)
    const lang = req.query.lang === 'en' ? 'en' : 'es'
    const max = Math.min(6, Math.max(1, Number(req.query.max) || 3))
    if (q.length < 2) return res.status(400).json({ error: 'Búsqueda demasiado corta' })
    try {
      const { value, stale } = await cached(`ml-topics:${lang}:${normalize(q)}:${max}`, 7 * DAY, async () => {
        const db = lang === 'es' ? 'healthTopicsSpanish' : 'healthTopics'
        const xml = await getText(`https://wsearch.nlm.nih.gov/ws/query?db=${db}&term=${encodeURIComponent(q)}&retmax=${max}`)
        return parseMedlineXml(xml).slice(0, max)
      })
      res.json({ query: q, lang, source: 'MedlinePlus (NIH/NLM)', topics: value, stale })
    } catch (err) {
      fail(res, err)
    }
  })

  async function resolveRxcui(name) {
    const key = normalize(name)
    const term = DRUG_ALIASES[key] ?? DRUG_ALIASES[key.split(' ')[0]] ?? key
    const approx = await getJson(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`)
    const candidate = approx?.approximateGroup?.candidate?.[0]?.rxcui
    if (!candidate) return null
    // MedlinePlus Connect responde mejor al principio activo (IN) que a una presentación comercial
    try {
      const rel = await getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${candidate}/related.json?tty=IN`)
      const ingredient = rel?.relatedGroup?.conceptGroup?.flatMap((g) => g.conceptProperties ?? [])?.[0]
      if (ingredient?.rxcui) return { rxcui: String(ingredient.rxcui), ingredient: ingredient.name }
    } catch {
      /* se usa el candidato directo */
    }
    return { rxcui: String(candidate), ingredient: '' }
  }

  router.get('/medlineplus/drug', async (req, res) => {
    const name = String(req.query.name ?? '').trim().slice(0, 80)
    const lang = req.query.lang === 'en' ? 'en' : 'es'
    const given = String(req.query.rxcui ?? '').replace(/\D/g, '')
    if (!given && name.length < 2) return res.status(400).json({ error: 'Falta el nombre del medicamento' })
    try {
      const { value, stale } = await cached(`ml-drug:${lang}:${given || normalize(name)}`, 7 * DAY, async () => {
        const resolved = given ? { rxcui: given, ingredient: '' } : await resolveRxcui(name)
        if (!resolved) return { rxcui: null, ingredient: '', entries: [] }
        const url =
          'https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88' +
          `&mainSearchCriteria.v.c=${resolved.rxcui}&informationRecipient.languageCode.c=${lang}&knowledgeResponseType=application/json`
        const raw = await getJson(url)
        const entries = (raw?.feed?.entry ?? [])
          .map((e) => ({
            title: toPlainText(e?.title?._value ?? e?.title),
            url: String((Array.isArray(e?.link) ? e.link[0]?.href : e?.link?.href) ?? ''),
            summary: clip(toPlainText(e?.summary?._value ?? e?.summary), 800),
          }))
          .filter((e) => e.title)
          .slice(0, 4)
        return { rxcui: resolved.rxcui, ingredient: resolved.ingredient, entries }
      })
      res.json({ query: name, lang, source: 'MedlinePlus (NIH/NLM)', ...value, stale })
    } catch (err) {
      fail(res, err)
    }
  })

  // -------------------------------------------------------------------------
  // Ciudades (autocompletado de ubicación). Solo se envía el texto escrito y, opcionalmente, el código de país.
  // -------------------------------------------------------------------------
  /** Respuesta de Open-Meteo → lista corta y sin repetidos de { name, admin1, country, countryCode, latitude, longitude }. */
  function normalizePlaces(raw) {
    const seen = new Set()
    const out = []
    for (const r of raw?.results ?? []) {
      if (!r?.name || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue
      const key = `${normalize(r.name)}|${normalize(r.admin1 ?? '')}|${r.country_code ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        name: String(r.name),
        admin1: r.admin1 ? String(r.admin1) : undefined,
        admin2: r.admin2 ? String(r.admin2) : undefined,
        country: String(r.country ?? r.country_code ?? ''),
        countryCode: String(r.country_code ?? ''),
        latitude: r.latitude,
        longitude: r.longitude,
        population: typeof r.population === 'number' ? r.population : undefined,
      })
    }
    return out
  }

  router.get('/geocode', async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 60)
    const countryCode = /^[A-Za-z]{2}$/.test(String(req.query.country ?? '')) ? String(req.query.country).toUpperCase() : ''
    const count = Math.min(10, Math.max(1, Number(req.query.count) || 8))
    if (q.length < 2) return res.status(400).json({ error: 'Búsqueda demasiado corta' })
    try {
      const { value, stale } = await cached(`geo:${countryCode}:${normalize(q)}:${count}`, 30 * DAY, async () => {
        const url =
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=es&format=json` +
          (countryCode ? `&countryCode=${countryCode}` : '')
        return normalizePlaces(await getJson(url))
      })
      res.json({ query: q, source: 'Open-Meteo / GeoNames', places: value, stale })
    } catch (err) {
      fail(res, err)
    }
  })

  // -------------------------------------------------------------------------
  // Lugares (hospitales, clínicas, vacunatorios…) para el campo "Ubicación". Nominatim exige User-Agent propio
  // y no más de 1 consulta por segundo: se serializa y se cachea.
  // -------------------------------------------------------------------------
  const HEALTH_TYPES = new Set(['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist', 'health_post', 'healthcare', 'laboratory', 'centre', 'vaccination_centre'])
  let nominatimQueue = Promise.resolve()
  let lastNominatim = 0
  const throttled = (fn) => {
    const run = nominatimQueue.then(async () => {
      const wait = lastNominatim + 1100 - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      lastNominatim = Date.now()
      return fn()
    })
    nominatimQueue = run.catch(() => {})
    return run
  }

  /** Respuesta de Nominatim → { name, detail, category, type, latitude, longitude, health }, sin repetidos, salud primero. */
  function normalizeVenues(raw) {
    const seen = new Set()
    const out = []
    for (const r of Array.isArray(raw) ? raw : []) {
      const lat = Number(r?.lat)
      const lon = Number(r?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const a = r.address ?? {}
      const name = String(r.name || a.amenity || a.healthcare || (r.display_name ?? '').split(',')[0] || '').trim()
      if (!name) continue
      const street = [a.road, a.house_number].filter(Boolean).join(' ')
      const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village || a.municipality
      const city = a.city || a.town || a.village || a.municipality || a.county
      const detail = [street, area && area !== city ? area : '', city].filter(Boolean).join(', ')
      const key = `${normalize(name)}|${normalize(detail)}`
      if (seen.has(key)) continue
      seen.add(key)
      const type = String(r.type ?? '')
      out.push({ name, detail, category: String(r.category ?? r.class ?? ''), type, latitude: lat, longitude: lon, health: HEALTH_TYPES.has(type) || r.category === 'healthcare' })
    }
    // Estable: los establecimientos de salud antes que calles o barrios
    return out.map((v, i) => ({ v, i })).sort((x, y) => Number(y.v.health) - Number(x.v.health) || x.i - y.i).map((x) => x.v)
  }

  router.get('/venues', async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 80)
    const countryCode = /^[A-Za-z]{2}$/.test(String(req.query.country ?? '')) ? String(req.query.country).toLowerCase() : ''
    const lat = Number(req.query.lat)
    const lon = Number(req.query.lon)
    const near = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    if (q.length < 2) return res.status(400).json({ error: 'Búsqueda demasiado corta' })
    try {
      const nearKey = near ? `${lat.toFixed(1)},${lon.toFixed(1)}` : ''
      const { value, stale } = await cached(`venues:${countryCode}:${nearKey}:${normalize(q)}`, 7 * DAY, async () => {
        const params = new URLSearchParams({ q, format: 'jsonv2', limit: '12', addressdetails: '1', 'accept-language': 'es', dedupe: '1' })
        if (countryCode) params.set('countrycodes', countryCode)
        // Sesgo (no filtro) hacia unos ~50 km alrededor de la ciudad del perfil
        if (near) params.set('viewbox', `${lon - 0.5},${lat + 0.5},${lon + 0.5},${lat - 0.5}`)
        return normalizeVenues(await throttled(() => getJson(`https://nominatim.openstreetmap.org/search?${params}`)))
      })
      res.json({ query: q, source: 'OpenStreetMap (Nominatim)', places: value.slice(0, 8), stale })
    } catch (err) {
      fail(res, err)
    }
  })

  router.get('/status', (_req, res) => {
    res.json({ ok: true, services: ['holidays', 'inflation', 'exercises', 'medlineplus', 'geocode', 'venues'], exercises: { ready: catalog.ready, total: catalog.items.length } })
  })

  return router
}
