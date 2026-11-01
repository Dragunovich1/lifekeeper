import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

process.env.JWT_SECRET = 'x'.repeat(64)
const { signToken, requireAuth } = await import('../src/auth.js')
const { createMailRouter } = await import('../src/mailRoutes.js')
const { renderTemplate, escapeHtml, TEMPLATE_IDS } = await import('../src/mailTemplates.js')

function setup({ perUserPerHour = 20 } = {}) {
  const sent = []
  const app = express()
  app.use(express.json())
  app.use('/api/mail', createMailRouter({ send: async (m) => { sent.push(m); return { id: 'x' } }, auth: requireAuth, perUserPerHour }))
  const server = app.listen(0)
  const base = `http://localhost:${server.address().port}/api/mail`
  const post = (body, token) =>
    fetch(`${base}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  return { sent, post, close: () => server.close() }
}

const token = (email = 'dueno@ejemplo.com', userId = 'u1') => signToken({ userId, email })

test('sin sesión no se puede enviar nada (el hueco del retransmisor de correo)', async () => {
  const { post, sent, close } = setup()
  const res = await post({ template: 'welcome', params: { name: 'x' }, to: 'victima@ejemplo.com' })
  assert.equal(res.status, 401)
  assert.equal(sent.length, 0)
  close()
})

test('el endpoint viejo /send ya no existe', async () => {
  const { close } = setup()
  const app = express()
  app.use(express.json())
  app.use('/api/mail', createMailRouter({ send: async () => ({}), auth: requireAuth }))
  const server = app.listen(0)
  const res = await fetch(`http://localhost:${server.address().port}/api/mail/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'a@b.com', subject: 'x', html: '<b>x</b>' }) })
  assert.equal(res.status, 404)
  server.close()
  close()
})

test('con sesión: el destinatario es SIEMPRE la cuenta, aunque el cliente mande otro "to"', async () => {
  const { post, sent, close } = setup()
  const res = await post({ template: 'welcome', params: { name: 'Dani' }, to: 'victima@ejemplo.com', from: 'ceo@banco.com', subject: 'Phishing', html: '<h1>hola</h1>' }, token('dueno@ejemplo.com'))
  assert.equal(res.status, 200)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'dueno@ejemplo.com')
  assert.equal(sent[0].from, undefined, 'el remitente lo fija el servidor')
  assert.ok(!sent[0].html.includes('Phishing') && !sent[0].subject.includes('Phishing'), 'no se acepta asunto ni HTML del cliente')
  close()
})

test('plantilla inexistente → 400 y no se envía', async () => {
  const { post, sent, close } = setup()
  const res = await post({ template: 'cualquier-cosa', params: {} }, token())
  assert.equal(res.status, 400)
  assert.equal(sent.length, 0)
  close()
})

test('los datos del cliente se escapan: no se puede inyectar HTML en el correo', async () => {
  const { post, sent, close } = setup()
  await post({ template: 'new_login', params: { device: '<img src=x onerror=alert(1)>', ip: '"><script>x</script>', timestamp: 'hoy' } }, token())
  assert.equal(sent.length, 1)
  assert.ok(!sent[0].html.includes('<img src=x'))
  assert.ok(!sent[0].html.includes('<script>x'))
  assert.ok(sent[0].html.includes('&lt;img'))
  close()
})

test('límite por usuario: pasada la cuota responde 429 sin enviar', async () => {
  const { post, sent, close } = setup({ perUserPerHour: 3 })
  for (let i = 0; i < 3; i++) assert.equal((await post({ template: 'backup_success', params: {} }, token())).status, 200)
  const res = await post({ template: 'backup_success', params: {} }, token())
  assert.equal(res.status, 429)
  assert.ok(res.headers.get('retry-after'))
  assert.equal(sent.length, 3)
  assert.equal((await post({ template: 'backup_success', params: {} }, token('otro@ejemplo.com', 'u2'))).status, 200, 'otro usuario tiene su propia cuota')
  close()
})

test('un token firmado con otra clave se rechaza', async () => {
  const { post, sent, close } = setup()
  const jwt = (await import('jsonwebtoken')).default
  const forged = jwt.sign({ userId: 'u1', email: 'dueno@ejemplo.com' }, 'lifekeeper_super_secure_jwt_secret_2026_xyz')
  assert.equal((await post({ template: 'welcome', params: {} }, forged)).status, 401)
  assert.equal(sent.length, 0)
  close()
})

test('plantillas: todas se arman y escapan HTML', () => {
  assert.deepEqual([...TEMPLATE_IDS].sort(), ['backup_success', 'brute_force', 'health_reminder', 'new_login', 'welcome'])
  for (const id of TEMPLATE_IDS) {
    const m = renderTemplate(id, { name: '<b>x</b>', title: '<b>x</b>', detail: '<i>d</i>', device: '<u>d</u>' })
    assert.ok(m.subject && m.html && m.text, id)
    assert.ok(!m.html.includes('<b>x</b>') && !m.html.includes('<i>d</i>') && !m.html.includes('<u>d</u>'), `${id} escapa`)
  }
  assert.equal(renderTemplate('nope'), null)
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
})
