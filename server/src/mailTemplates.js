/**
 * Plantillas de correos transaccionales (se arman en el servidor).
 *
 * Por qué acá y no en el cliente: así nadie puede mandar contenido libre con la marca y el dominio de
 * LifeKeeper. El cliente solo elige una plantilla y pasa datos simples, que se validan y se escapan.
 */

const BRAND_COLOR_PRIMARY = '#1d63dc'
const BRAND_DOMAIN = 'app.lifekeeper.lat'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

/** Texto corto y sin saltos de línea: sirve para asuntos y para datos que van dentro del HTML. */
const clean = (value, max = 120) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)

function emailLayout(title, bodyContent, isAlert = false) {
  const accentColor = isAlert ? '#ef4444' : BRAND_COLOR_PRIMARY

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #060b18;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #060b18;
      padding: 40px 10px;
    }
    .main-card {
      max-width: 580px;
      margin: 0 auto;
      background: linear-gradient(180deg, #0e1a38 0%, #0a1329 100%);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }
    .header {
      padding: 32px 36px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .brand-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin: 0;
    }
    .brand-accent {
      color: #38bdf8;
    }
    .body {
      padding: 32px 36px;
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .h1-title {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .callout {
      background: rgba(255, 255, 255, 0.03);
      border-left: 4px solid ${accentColor};
      border-radius: 8px;
      padding: 16px 18px;
      margin: 24px 0;
      font-size: 14px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #1d63dc 0%, #0284c7 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 13px 28px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
      box-shadow: 0 4px 14px rgba(29, 99, 220, 0.35);
    }
    .btn-alert {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
    }
    .footer {
      padding: 24px 36px 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-card" role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 12px; vertical-align: middle;">
                      <img src="https://app.lifekeeper.lat/brand/isotipo.png?v=2" alt="LifeKeeper" width="36" height="36" style="display: block; border-radius: 8px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <h1 class="brand-title">Life<span class="brand-accent">Keeper</span></h1>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                Cero Conocimiento E2EE
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="body">
          ${bodyContent}
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0 0 8px;">Este es un mensaje de seguridad automatizado enviado por <strong>LifeKeeper Vault</strong>.</p>
          <p style="margin: 0 0 8px;">Por arquitectura de conocimiento cero, nosotros nunca te pediremos contraseñas ni frases de rescate.</p>
          <p style="margin: 0;"><a href="https://${BRAND_DOMAIN}">https://${BRAND_DOMAIN}</a> • Servidor Soberano y Seguro</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`
}


const TEMPLATES = {
  welcome({ name }) {
    const userName = clean(name, 60) || 'Titular de Bóveda'
    const subject = 'Bienvenido a LifeKeeper — Tu bóveda privada está lista'
    const html = emailLayout(
      subject,
      `
    <h2 class="h1-title">¡Hola, ${escapeHtml(userName)}! 👋</h2>
    <p>Tu bóveda personal en <strong>LifeKeeper</strong> ha sido creada exitosamente. A partir de hoy, tus registros de salud, finanzas, contraseñas y diario personal están protegidos bajo cifrado de extremo a extremo.</p>

    <div class="callout">
      <strong style="color: #38bdf8;">🛡️ Regla de Oro de Conocimiento Cero (Zero-Knowledge):</strong>
      <p style="margin: 8px 0 0;">Tu contraseña maestra nunca viaja por la red ni se guarda en nuestros servidores. <strong>Nadie más que vos puede descifrar tu información.</strong></p>
    </div>

    <p><strong>Paso fundamental:</strong> Si no descargaste tu <strong>Kit de Emergencia (PDF de 24 palabras)</strong> durante el registro, ingresá ahora a tu perfil o a la sección de Respaldos para generarlo e imprimirlo.</p>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}/#profile:settings" class="btn">Abrir mi Bóveda</a>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">Si tenés alguna duda sobre el funcionamiento del cifrado o la soberanía de tus datos, estamos a tu disposición.</p>
    `,
    )
    const text = `¡Hola, ${userName}!\n\nTu bóveda en LifeKeeper ha sido creada exitosamente bajo arquitectura Zero-Knowledge E2EE.\n\nGuardá tu Kit de Emergencia de 24 palabras en un lugar físico seguro.\n\nIngresá a tu bóveda: https://${BRAND_DOMAIN}`
    return { subject, html, text }
  },

  new_login({ device, ip, timestamp, locationApprox }) {
    const info = { device: clean(device) || 'Dispositivo desconocido', ip: clean(ip, 64) || 'Desconocida', timestamp: clean(timestamp, 60) || new Date().toLocaleString('es-AR'), location: clean(locationApprox) }
    const subject = '⚠️ Alerta de Seguridad: Nuevo inicio de sesión en tu bóveda'
    const html = emailLayout(
      subject,
      `
    <h2 class="h1-title" style="color: #fbbf24;">Nuevo inicio de sesión detectado</h2>
    <p>Se acaba de desbloquear tu bóveda de LifeKeeper desde un nuevo dispositivo o navegador.</p>

    <div class="callout" style="border-left-color: #fbbf24;">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Fecha y hora:</strong> ${escapeHtml(info.timestamp)}</li>
        <li><strong>Dispositivo / Navegador:</strong> ${escapeHtml(info.device)}</li>
        <li><strong>Dirección IP:</strong> ${escapeHtml(info.ip)}</li>
        ${info.location ? `<li><strong>Ubicación aproximada:</strong> ${escapeHtml(info.location)}</li>` : ''}
      </ul>
    </div>

    <p><strong>¿Fuiste vos?</strong> Si reconocés esta actividad, podés ignorar este correo con tranquilidad.</p>
    <p><strong>¿No fuiste vos?</strong> Alguien podría estar intentando acceder a tu cuenta. Te recomendamos ingresar de inmediato desde tu equipo habitual y cambiar tu contraseña maestra.</p>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}/#security:passwords" class="btn btn-alert">Revisar Actividad de Seguridad</a>
    </div>
    `,
      true,
    )
    const text = `Alerta de Seguridad - LifeKeeper\n\nNuevo inicio de sesión detectado:\nFecha: ${info.timestamp}\nDispositivo: ${info.device}\nIP: ${info.ip}\n\nSi no fuiste vos, ingresá a https://${BRAND_DOMAIN} y cambiá tu contraseña maestra.`
    return { subject, html, text }
  },

  brute_force({ failedCount, ip }) {
    const count = Math.max(1, Math.min(999, Number(failedCount) || 1))
    const clientIp = clean(ip, 64) || 'Desconocida'
    const subject = `🚨 URGENTE: ${count} intentos fallidos de acceso a tu bóveda`
    const html = emailLayout(
      subject,
      `
    <h2 class="h1-title" style="color: #ef4444;">Intento de acceso no autorizado</h2>
    <p>Hemos registrado <strong>${count} intentos fallidos consecutivos</strong> para acceder a tu cuenta de LifeKeeper desde la dirección IP <code>${escapeHtml(clientIp)}</code>.</p>

    <div class="callout" style="border-left-color: #ef4444; background: rgba(239, 68, 68, 0.08);">
      <strong style="color: #f87171;">Protocolo de Protección Activo:</strong>
      <p style="margin: 8px 0 0;">Tras varios intentos fallidos seguidos, el acceso desde esa dirección se bloquea temporalmente para resguardar la confidencialidad de tus datos.</p>
    </div>

    <p>Si olvidaste tu contraseña maestra, recordá que podés restaurar el acceso con tu <strong>Kit de Emergencia (24 palabras de rescate)</strong>.</p>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}" class="btn btn-alert">Ver Estado de Bóveda</a>
    </div>
    `,
      true,
    )
    const text = `URGENTE: ${count} intentos fallidos de acceso a tu cuenta desde la IP ${clientIp}.\nEl acceso se bloquea temporalmente tras varios intentos.\nUsá tu Kit de Emergencia si necesitás recuperar tu bóveda: https://${BRAND_DOMAIN}`
    return { subject, html, text }
  },

  backup_success({ timestamp, snapshotId, sizeKb }) {
    const when = clean(timestamp, 60) || new Date().toLocaleString('es-AR')
    const snapshot = clean(snapshotId, 64) || 's/d'
    const size = Math.max(0, Math.min(10_000_000, Number(sizeKb) || 0))
    const subject = 'Backup seguro completado — LifeKeeper Vault'
    const html = emailLayout(
      subject,
      `
    <h2 class="h1-title">Respaldo de bóveda guardado</h2>
    <p>Se ha generado y sincronizado un nuevo snapshot cifrado de tu bóveda.</p>

    <div class="callout">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Fecha del respaldo:</strong> ${escapeHtml(when)}</li>
        <li><strong>Identificador de snapshot:</strong> <code style="font-size: 12px; color: #38bdf8;">${escapeHtml(snapshot)}</code></li>
        <li><strong>Tamaño del payload cifrado:</strong> ${size} KB</li>
        <li><strong>Algoritmo:</strong> AES-256-GCM (Zero-Knowledge)</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">Tu información viaja y se almacena en reposo 100% cifrada. Podés descargar copias locales de respaldo en cualquier momento desde la sección de Utilidades.</p>
    `,
    )
    const text = `Respaldo seguro completado en LifeKeeper.\nFecha: ${when}\nSnapshot: ${snapshot}\nTamaño: ${size} KB\nCifrado con AES-256-GCM.`
    return { subject, html, text }
  },

  health_reminder({ title, category, detail, dueDateTime }) {
    const kind = ['medicamento', 'vacuna', 'turno'].includes(category) ? category : 'turno'
    const icon = kind === 'medicamento' ? '💊' : kind === 'vacuna' ? '💉' : '🩺'
    const t = clean(title, 100) || 'Recordatorio'
    const d = clean(detail, 200)
    const due = clean(dueDateTime, 60)
    const subject = `${icon} Recordatorio de Salud: ${t}`
    const html = emailLayout(
      subject,
      `
    <h2 class="h1-title">${icon} Recordatorio Programado</h2>
    <p>Tu asistente de salud en LifeKeeper te recuerda el siguiente evento prioritario:</p>

    <div class="callout" style="border-left-color: #0ea5e9;">
      <h3 style="margin: 0 0 8px; color: #38bdf8; font-size: 16px;">${escapeHtml(t)}</h3>
      <p style="margin: 0 0 8px; color: #ffffff;">${escapeHtml(d)}</p>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;"><strong>Horario programado:</strong> ${escapeHtml(due)}</p>
    </div>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}/#health:medications" class="btn">Abrir Sección Salud</a>
    </div>
    `,
    )
    const text = `Recordatorio de Salud LifeKeeper:\n\n${t}\n${d}\nHorario: ${due}\n\nIngresá a tu bóveda: https://${BRAND_DOMAIN}`
    return { subject, html, text }
  },
}

export const TEMPLATE_IDS = Object.keys(TEMPLATES)

/** Devuelve { subject, html, text } o null si la plantilla no existe. */
export function renderTemplate(id, params = {}) {
  const build = Object.hasOwn(TEMPLATES, id) ? TEMPLATES[id] : null
  return build ? build(params && typeof params === 'object' ? params : {}) : null
}
