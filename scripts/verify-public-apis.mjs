#!/usr/bin/env node
/**
 * Verifica que las APIs públicas que usa LifeKeeper estén vivas y respondan con el formato esperado.
 * Corré esto en el servidor (el Dell), que es quien sale a internet:
 *
 *   node scripts/verify-public-apis.mjs                  # usa http://localhost (nginx)
 *   node scripts/verify-public-apis.mjs http://localhost:4000
 *
 * 1) Prueba cada API externa directamente (diagnóstico: dice cuál falla).
 * 2) Prueba los endpoints propios /api/public/* que usa la app.
 */

const base = (process.argv[2] || 'http://localhost').replace(/\/+$/, '')
const UA = 'LifeKeeper/1.0 (verificación)'
const year = new Date().getFullYear()
let failures = 0

const line = (ok, name, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  —  ${detail}` : ''}`)
}

async function timed(url, init = {}) {
  const t0 = Date.now()
  const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) })
  return { res, ms: Date.now() - t0 }
}

async function check(name, url, test) {
  try {
    const { res, ms } = await timed(url)
    if (!res.ok) return line(false, name, `HTTP ${res.status} (${ms} ms)`)
    const raw = await res.text()
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      body = raw
    }
    const verdict = test(body)
    line(verdict === true, name, verdict === true ? `${ms} ms` : String(verdict))
    return body
  } catch (err) {
    line(false, name, String(err?.message ?? err))
  }
}

console.log('\n── 1) APIs externas, directo ─────────────────────────────')
await check('ArgentinaDatos · feriados', `https://api.argentinadatos.com/v1/feriados/${year}`, (b) => (Array.isArray(b) && b[0]?.fecha && b[0]?.nombre ? true : `formato inesperado: ${JSON.stringify(b).slice(0, 120)}`))
await check('datos.gob.ar · serie IPC', 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&format=json&limit=3&sort=desc', (b) => (Array.isArray(b?.data) && typeof b.data[0]?.[1] === 'number' ? true : `formato inesperado: ${JSON.stringify(b).slice(0, 160)}`))
await check('ArgentinaDatos · inflación (respaldo)', 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion', (b) => (Array.isArray(b) && b[0]?.fecha !== undefined && b[0]?.valor !== undefined ? true : `formato inesperado: ${JSON.stringify(b).slice(0, 120)}`))
const langs = await check('wger · idiomas', 'https://wger.de/api/v2/language/?limit=100', (b) => (Array.isArray(b?.results) && b.results.some((l) => l.short_name === 'es') ? true : 'no aparece el español'))
if (langs) console.log(`      id de español: ${langs.results.find((l) => l.short_name === 'es')?.id}`)
const ex = await check('wger · ejercicios', 'https://wger.de/api/v2/exerciseinfo/?limit=1', (b) => (b?.results?.[0] ? true : 'sin resultados'))
if (ex?.results?.[0]) console.log(`      campos: ${Object.keys(ex.results[0]).join(', ')}`)
await check('MedlinePlus · temas (español)', 'https://wsearch.nlm.nih.gov/ws/query?db=healthTopicsSpanish&term=diabetes&retmax=1', (b) => (typeof b === 'string' && /<document/.test(b) ? true : `sin <document>: ${String(b).slice(0, 120)}`))
const rx = await check('RxNav · medicamento', 'https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=ibuprofen&maxEntries=1', (b) => (b?.approximateGroup?.candidate?.[0]?.rxcui ? true : 'sin candidato'))
const rxcui = rx?.approximateGroup?.candidate?.[0]?.rxcui ?? '5640'
await check('MedlinePlus Connect · medicamento', `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88&mainSearchCriteria.v.c=${rxcui}&informationRecipient.languageCode.c=es&knowledgeResponseType=application/json`, (b) => (b?.feed ? true : `sin feed: ${JSON.stringify(b).slice(0, 120)}`))

console.log(`\n── 2) Endpoints propios (${base}/api/public) ──────────────`)
await check('estado del módulo', `${base}/api/public/status`, (b) => (b?.ok ? true : 'respuesta inesperada (¿se reconstruyó la imagen api?)'))
await check('feriados', `${base}/api/public/holidays?year=${year}`, (b) => (b?.holidays?.length > 0 ? true : `sin feriados: ${JSON.stringify(b).slice(0, 120)}`))
await check('inflación', `${base}/api/public/inflation?months=24`, (b) => {
  if (b?.latest?.monthly === undefined) return `sin datos: ${JSON.stringify(b).slice(0, 140)}`
  console.log(`      último dato: ${b.latest.month} · ${b.latest.monthly}% mensual · ${b.latest.yoy}% interanual · fuente: ${b.source}`)
  return true
})

process.stdout.write('   catálogo de ejercicios: ')
let ready = false
for (let i = 0; i < 45 && !ready; i++) {
  try {
    const { res } = await timed(`${base}/api/public/exercises?q=press`)
    const b = await res.json()
    ready = Boolean(b.ready)
    if (ready) console.log(`listo (${b.total ?? '?'} ejercicios). Primer resultado: ${b.results?.[0]?.name ?? '—'}`)
  } catch {
    /* sigue esperando */
  }
  if (!ready) await new Promise((r) => setTimeout(r, 2000))
}
line(ready, 'ejercicios (wger)', ready ? '' : 'el catálogo no se cargó en 90 s; mirá los logs del contenedor api')
await check('MedlinePlus · temas', `${base}/api/public/medlineplus/topics?q=diabetes&max=2`, (b) => (b?.topics?.length > 0 ? true : `sin temas: ${JSON.stringify(b).slice(0, 140)}`))
await check('MedlinePlus · medicamento', `${base}/api/public/medlineplus/drug?name=ibuprofeno`, (b) => (b?.entries?.length > 0 ? true : `sin fichas (rxcui=${b?.rxcui ?? 'no resuelto'})`))

console.log(failures === 0 ? '\nTodo en orden ✅' : `\n${failures} verificación(es) fallaron ❌ — pasame esta salida y lo ajusto.`)
process.exit(failures === 0 ? 0 : 1)
