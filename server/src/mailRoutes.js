/**
 * Correos transaccionales.
 *
 * Reglas (para que el servidor no sirva de retransmisor de spam ni de phishing):
 *  - Solo con sesión iniciada.
 *  - El destinatario es SIEMPRE el correo de la cuenta (el token), nunca el que mande el cliente.
 *  - El cliente elige una plantilla del servidor y pasa datos simples (se escapan); no hay HTML libre.
 *  - Remitente fijo y límite por usuario.
 */

import { Router } from 'express'
import { createRateLimiter, limitBy } from './security.js'
import { renderTemplate, TEMPLATE_IDS } from './mailTemplates.js'

export function createMailRouter({ send, auth, perUserPerHour = 20 }) {
  const router = Router()
  const limiter = createRateLimiter({ windowMs: 3_600_000, max: perUserPerHour })

  router.post('/notify', auth, limitBy(limiter, (req) => req.user.userId, 'Demasiados correos en la última hora.'), async (req, res) => {
    const { template, params } = req.body ?? {}
    if (typeof template !== 'string' || !TEMPLATE_IDS.includes(template)) {
      return res.status(400).json({ error: 'Plantilla no válida', templates: TEMPLATE_IDS })
    }
    const to = req.user.email
    if (!to) return res.status(400).json({ error: 'La sesión no tiene un correo asociado' })

    const mail = renderTemplate(template, params)
    try {
      const result = await send({ to, subject: mail.subject, html: mail.html, text: mail.text })
      res.json({ success: true, template, result })
    } catch (err) {
      res.status(500).json({ error: 'No se pudo enviar el correo', details: String(err?.message ?? err) })
    }
  })

  return router
}
