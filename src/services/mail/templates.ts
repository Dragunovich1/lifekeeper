/**
 * Templates oficiales de correos electrónicos transaccionales para LifeKeeper.
 * Diseñados con HTML responsive, accesibilidad, branding oficial y remitente @lifekeeper.lat.
 */

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text: string
}

const BRAND_COLOR_PRIMARY = '#1d63dc'
const BRAND_DOMAIN = 'lifekeeper.lat'

/**
 * Envoltorio HTML base para todos los correos de LifeKeeper.
 */
function emailLayout(title: string, bodyContent: string, isAlert = false): string {
  const accentColor = isAlert ? '#ef4444' : BRAND_COLOR_PRIMARY

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
              <td>
                <h1 class="brand-title">Life<span class="brand-accent">Keeper</span></h1>
              </td>
              <td align="right" style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
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

/**
 * 1. Email de Bienvenida y Creación de Bóveda
 */
export function getWelcomeEmail(userName: string, userEmail: string): EmailPayload {
  const subject = 'Bienvenido a LifeKeeper — Tu bóveda privada está lista'
  const html = emailLayout(
    subject,
    `
    <h2 class="h1-title">¡Hola, ${userName || 'Titular de Bóveda'}! 👋</h2>
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

  const text = `¡Hola, ${userName || 'Titular de Bóveda'}!\n\nTu bóveda en LifeKeeper ha sido creada exitosamente bajo arquitectura Zero-Knowledge E2EE.\n\nRecuerda guardar tu Kit de Emergencia de 24 palabras en un lugar físico seguro.\n\nIngresá a tu bóveda: https://${BRAND_DOMAIN}`

  return { to: userEmail, subject, html, text }
}

/**
 * 2. Alerta de Seguridad por Nuevo Inicio de Sesión
 */
export function getNewLoginAlertEmail(
  userEmail: string,
  loginInfo: { device: string; ip: string; timestamp: string; locationApprox?: string },
): EmailPayload {
  const subject = '⚠️ Alerta de Seguridad: Nuevo inicio de sesión en tu bóveda'
  const html = emailLayout(
    subject,
    `
    <h2 class="h1-title" style="color: #fbbf24;">Nuevo inicio de sesión detectado</h2>
    <p>Se acaba de desbloquear tu bóveda de LifeKeeper desde un nuevo dispositivo o navegador.</p>
    
    <div class="callout" style="border-left-color: #fbbf24;">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Fecha y hora:</strong> ${loginInfo.timestamp}</li>
        <li><strong>Dispositivo / Navegador:</strong> ${loginInfo.device}</li>
        <li><strong>Dirección IP:</strong> ${loginInfo.ip}</li>
        ${loginInfo.locationApprox ? `<li><strong>Ubicación aproximada:</strong> ${loginInfo.locationApprox}</li>` : ''}
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

  const text = `Alerta de Seguridad - LifeKeeper\n\nNuevo inicio de sesión detectado:\nFecha: ${loginInfo.timestamp}\nDispositivo: ${loginInfo.device}\nIP: ${loginInfo.ip}\n\nSi no fuiste vos, ingresá a https://${BRAND_DOMAIN} y cambiá tu contraseña maestra.`

  return { to: userEmail, subject, html, text }
}

/**
 * 3. Alerta Crítica por Intentos Fallidos de Contraseña (Fuerza Bruta)
 */
export function getBruteForceAlertEmail(
  userEmail: string,
  failedCount: number,
  clientIp: string,
): EmailPayload {
  const subject = `🚨 URGENTE: ${failedCount} intentos fallidos de acceso a tu bóveda`
  const html = emailLayout(
    subject,
    `
    <h2 class="h1-title" style="color: #ef4444;">Intento de acceso no autorizado</h2>
    <p>Hemos registrado <strong>${failedCount} intentos fallidos consecutivos</strong> para descifrar tu bóveda de LifeKeeper desde la dirección IP <code>${clientIp}</code>.</p>
    
    <div class="callout" style="border-left-color: #ef4444; background: rgba(239, 68, 68, 0.08);">
      <strong style="color: #f87171;">Protocolo de Protección Activo:</strong>
      <p style="margin: 8px 0 0;">Si se alcanzan 10 intentos fallidos continuos, el cliente local activará la autodestrucción de la sesión en ese navegador para resguardar la confidencialidad de tus datos.</p>
    </div>

    <p>Si olvidaste tu contraseña maestra, recordá que podés restaurar el acceso con tu <strong>Kit de Emergencia (24 palabras de rescate)</strong>.</p>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}" class="btn btn-alert">Ver Estado de Bóveda</a>
    </div>
    `,
    true,
  )

  const text = `URGENTE: ${failedCount} intentos fallidos de acceso a tu bóveda desde la IP ${clientIp}.\nAl 10° intento se bloqueará el acceso local.\nUsa tu Kit de Emergencia si necesitas recuperar tu bóveda: https://${BRAND_DOMAIN}`

  return { to: userEmail, subject, html, text }
}

/**
 * 4. Notificación de Respaldo Cifrado Exitoso
 */
export function getBackupSuccessEmail(
  userEmail: string,
  backupDetails: { timestamp: string; snapshotId: string; sizeKb: number },
): EmailPayload {
  const subject = 'Backup seguro completado — LifeKeeper Vault'
  const html = emailLayout(
    subject,
    `
    <h2 class="h1-title">Respaldo de bóveda guardado</h2>
    <p>Se ha generado y sincronizado un nuevo snapshot cifrado de tu bóveda.</p>
    
    <div class="callout">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Fecha del respaldo:</strong> ${backupDetails.timestamp}</li>
        <li><strong>Identificador de snapshot:</strong> <code style="font-size: 12px; color: #38bdf8;">${backupDetails.snapshotId}</code></li>
        <li><strong>Tamaño del payload cifrado:</strong> ${backupDetails.sizeKb} KB</li>
        <li><strong>Algoritmo:</strong> AES-256-GCM (Zero-Knowledge)</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">Tu información viaja y se almacena en reposo 100% cifrada. Podés descargar copias locales de respaldo en cualquier momento desde la sección de Utilidades.</p>
    `,
  )

  const text = `Respaldo seguro completado en LifeKeeper.\nFecha: ${backupDetails.timestamp}\nSnapshot: ${backupDetails.snapshotId}\nTamaño: ${backupDetails.sizeKb} KB\nCifrado con AES-256-GCM.`

  return { to: userEmail, subject, html, text }
}

/**
 * 5. Recordatorio Preventivo de Salud y Medicación
 */
export function getHealthReminderEmail(
  userEmail: string,
  reminder: { title: string; category: 'medicamento' | 'vacuna' | 'turno'; detail: string; dueDateTime: string },
): EmailPayload {
  const icon = reminder.category === 'medicamento' ? '💊' : reminder.category === 'vacuna' ? '💉' : '🩺'
  const subject = `${icon} Recordatorio de Salud: ${reminder.title}`

  const html = emailLayout(
    subject,
    `
    <h2 class="h1-title">${icon} Recordatorio Programado</h2>
    <p>Tu asistente de salud en LifeKeeper te recuerda el siguiente evento prioritario:</p>
    
    <div class="callout" style="border-left-color: #0ea5e9;">
      <h3 style="margin: 0 0 8px; color: #38bdf8; font-size: 16px;">${reminder.title}</h3>
      <p style="margin: 0 0 8px; color: #ffffff;">${reminder.detail}</p>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;"><strong>Horario programado:</strong> ${reminder.dueDateTime}</p>
    </div>

    <div style="text-align: center;">
      <a href="https://${BRAND_DOMAIN}/#health:medications" class="btn">Abrir Sección Salud</a>
    </div>
    `,
  )

  const text = `Recordatorio de Salud LifeKeeper:\n\n${reminder.title}\n${reminder.detail}\nHorario: ${reminder.dueDateTime}\n\nIngresá a tu bóveda: https://${BRAND_DOMAIN}`

  return { to: userEmail, subject, html, text }
}
