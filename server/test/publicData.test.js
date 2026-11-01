import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createPublicDataRouter, toPlainText } from '../src/publicData.js'

let calls = []
let mode = { ipc: 'ok', holidays: 'ok', wger: 'ok', medline: 'ok' }
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) })
const text = (body) => ({ ok: true, status: 200, json: async () => ({}), text: async () => body })

// Índice IPC creciente: 1% mensual
const levels = Array.from({ length: 40 }, (_, i) => { const d = new Date(Date.UTC(2023, 5 + i, 1)); return [d.toISOString().slice(0, 10), +(1000 * Math.pow(1.01, i)).toFixed(3)] }).reverse()

const MEDLINE_XML = `<?xml version="1.0" encoding="UTF-8"?><nlmSearchResult><term>diabetes</term><count>2</count><list num="2" start="0" per="2">
<document url="https://medlineplus.gov/spanish/diabetes.html" rank="0"><content name="title">&lt;span class="qt0"&gt;Diabetes&lt;/span&gt;</content><content name="organizationName">MedlinePlus</content><content name="FullSummary">&lt;p&gt;La diabetes es una enfermedad en la que los niveles de &lt;strong&gt;az&amp;uacute;car&lt;/strong&gt; en la sangre est&amp;aacute;n altos.&lt;/p&gt;</content><content name="snippet">resumen corto</content></document>
<document url="https://medlineplus.gov/spanish/diabetestype2.html" rank="1"><content name="title">Diabetes tipo 2</content><content name="snippet">&lt;span class="qt0"&gt;Diabetes&lt;/span&gt; tipo 2: lo que debe saber</content></document>
</list></nlmSearchResult>`

const fetchImpl = async (url) => {
  const u = String(url); calls.push(u)
  if (u.includes('argentinadatos.com/v1/feriados/')) return mode.holidays === 'ok' ? json([{ fecha: '2026-01-01', tipo: 'inamovible', nombre: 'Año Nuevo' }, { fecha: '2026-03-24', tipo: 'inamovible', nombre: 'Día Nacional de la Memoria' }, { fecha: 'basura', nombre: 'x' }]) : json({}, 500)
  if (u.includes('apis.datos.gob.ar/series')) return mode.ipc === 'ok' ? json({ data: levels, meta: [] }) : json({ error: 'x' }, 400)
  if (u.includes('argentinadatos.com/v1/finanzas/indices/inflacion')) return json(Array.from({ length: 24 }, (_, i) => ({ fecha: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-28`, valor: 2 })))
  if (u.includes('wger.de/api/v2/language')) return json({ results: [{ id: 2, short_name: 'en' }, { id: 4, short_name: 'es' }] })
  if (u.includes('wger.de/api/v2/exerciseinfo')) {
    if (mode.wger !== 'ok') return json({}, 503)
    const page2 = u.includes('offset=100')
    return json({ count: 3, next: page2 ? null : 'http://wger.de/api/v2/exerciseinfo/?limit=100&offset=100', results: page2 ? [
      { id: 3, category: { name: 'Piernas' }, muscles: [{ name: 'Quadriceps femoris', name_en: 'Quads' }], muscles_secondary: [], equipment: [{ name: 'Barra' }], images: [], translations: [{ name: 'Squat', language: 2 }] }
    ] : [
      { id: 1, category: { name: 'Pecho' }, muscles: [{ name: 'Pectoralis major', name_en: 'Chest' }], muscles_secondary: [{ name: 'Triceps brachii', name_en: 'Triceps' }], equipment: [{ name: 'Barra' }, { name: 'Banco' }], images: [{ image: 'https://wger.de/media/a.png', is_main: true }], translations: [{ name: 'Press de banca', language: 4 }, { name: 'Bench press', language: 2 }] },
      { id: 2, category: { name: 'Espalda' }, muscles: [{ name: 'Latissimus dorsi', name_en: 'Lats' }], equipment: [], images: [], translations: [{ name: 'Dominadas', language: 4 }] },
    ] })
  }
  if (u.includes('wsearch.nlm.nih.gov')) return mode.medline === 'ok' ? text(MEDLINE_XML) : json({}, 500)
  if (u.includes('approximateTerm')) return json({ approximateGroup: { candidate: [{ rxcui: '5640' }] } })
  if (u.includes('/related.json')) return json({ relatedGroup: { conceptGroup: [{ tty: 'IN', conceptProperties: [{ rxcui: '5640', name: 'ibuprofen' }] }] } })
  if (u.includes('connect.medlineplus.gov')) return json({ feed: { entry: [{ title: { _value: 'Ibuprofeno' }, link: [{ href: 'https://medlineplus.gov/spanish/druginfo/meds/a682159-es.html' }], summary: { _value: '<p>El ibuprofeno se usa para aliviar el <b>dolor</b>.</p>' } }] } })
  return json({}, 404)
}

test('datos públicos: feriados, inflación, ejercicios y MedlinePlus (con respaldo y caché)', async () => {
  const app = express(); app.use('/api/public', createPublicDataRouter({ fetchImpl, cacheFile: `${process.env.TMPDIR || '/tmp'}/lk-test-wger-${process.pid}.json`, preloadExercises: false }))
  const server = app.listen(0); const base = `http://localhost:${server.address().port}/api/public`
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() } }
  const ok = (name, cond, extra = '') => assert.ok(cond, `${name} ${extra}`)

  let r = await get('/holidays?year=2026'); ok('feriados', r.status === 200 && r.body.holidays.length === 2 && r.body.holidays[0].date === '2026-01-01', JSON.stringify(r.body.holidays))
  ok('feriados año inválido', (await get('/holidays?year=1800')).status === 400)
  mode.holidays = 'down'; r = await get('/holidays?year=2026'); ok('feriados: caché fresca no llama de nuevo', r.status === 200 && !r.body.stale)
  r = await get('/holidays?year=2027'); ok('feriados: sin caché y fuente caída → 502', r.status === 502)

  r = await get('/inflation?months=12'); const last = r.body.latest
  ok('inflación IPC', r.status === 200 && r.body.series.length === 12 && Math.abs(last.monthly - 1) < 0.01 && Math.abs(last.yoy - 12.68) < 0.05, `fuente=${r.body.source} último=${JSON.stringify(last)}`)
  mode.ipc = 'down'; calls = []; r = await get('/inflation?months=6')
  ok('inflación: respaldo ArgentinaDatos', r.status === 200 && r.body.source.includes('ArgentinaDatos') && r.body.latest.monthly === 2 && r.body.latest.yoy > 26 && r.body.latest.yoy < 27, JSON.stringify(r.body.latest))

  r = await get('/exercises?q=press'); ok('ejercicios: aún sin catálogo → ready:false', r.status === 200 && r.body.ready === false)
  await new Promise((res) => setTimeout(res, 600))
  r = await get('/exercises?q=press'); ok('ejercicios: busca en español', r.body.ready && r.body.results[0]?.name === 'Press de banca' && r.body.results[0].muscles[0] === 'Chest' && r.body.results[0].equipment.length === 2 && r.body.results[0].image.includes('a.png'), JSON.stringify(r.body.results[0]))
  r = await get('/exercises?q=bench'); ok('ejercicios: busca por nombre en inglés', r.body.results[0]?.name === 'Press de banca')
  r = await get('/exercises?q=SQUAT'); ok('ejercicios: sin traducción al español → inglés', r.body.results[0]?.lang === 'en' && r.body.results[0].name === 'Squat')
  r = await get('/exercises?q=dominadas'); ok('ejercicios: sin acentos/mayúsculas', r.body.results.length === 1)
  r = await get('/exercises/status'); ok('ejercicios: estado', r.body.ready && r.body.total === 3)

  r = await get('/medlineplus/topics?q=diabetes&max=2'); ok('MedlinePlus temas', r.status === 200 && r.body.topics.length === 2 && r.body.topics[0].title === 'Diabetes' && r.body.topics[0].summary.startsWith('La diabetes es una enfermedad') && r.body.topics[0].summary.includes('azúcar') && r.body.topics[0].summary.includes('están'), JSON.stringify(r.body.topics[0]))
  ok('MedlinePlus: sin etiquetas HTML', !/[<>]/.test(JSON.stringify(r.body.topics)))
  ok('MedlinePlus: búsqueda corta', (await get('/medlineplus/topics?q=a')).status === 400)
  r = await get('/medlineplus/drug?name=Ibuprofeno'); ok('MedlinePlus medicamento', r.status === 200 && r.body.rxcui === '5640' && r.body.entries[0].title === 'Ibuprofeno' && r.body.entries[0].summary === 'El ibuprofeno se usa para aliviar el dolor.', JSON.stringify(r.body.entries[0]))
  calls = []; await get('/medlineplus/drug?name=Paracetamol'); ok('alias paracetamol → acetaminophen', calls.some((c) => c.includes('term=acetaminophen')), calls.find((c) => c.includes('approximate')))
  mode.medline = 'down'; r = await get('/medlineplus/topics?q=otro tema'); ok('MedlinePlus caído sin caché → 502', r.status === 502)
  assert.equal(toPlainText('&lt;p&gt;Hola &amp;amp; <b>mundo</b>&lt;/p&gt;'), 'Hola & mundo')
  server.close()

})
