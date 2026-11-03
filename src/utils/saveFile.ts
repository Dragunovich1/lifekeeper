import type { jsPDF } from 'jspdf'
import { isNativePlatform } from '../services/platform'

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })

/**
 * Guarda/entrega un archivo generado en la app.
 * - Web: descarga normal (file-saver).
 * - APK Android: el WebView NO descarga blobs, así que se escribe en el caché privado de la app y se abre el menú
 *   "Compartir" de Android (Guardar en Descargas, Drive, WhatsApp, correo…).
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (!isNativePlatform()) {
    const { saveAs } = await import('file-saver')
    saveAs(blob, filename)
    return
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])

  // Limpieza: los exportes viejos (pueden tener datos sensibles) no se quedan en el caché
  try {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache })
    const cutoff = Date.now() - 60 * 60_000
    await Promise.all(
      files
        .filter((f) => f.type === 'file' && /\.(json|xlsx|csv|pdf|ics|txt)$/i.test(f.name) && (f.mtime ?? 0) < cutoff)
        .map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => undefined)),
    )
  } catch {
    /* sin permisos de listado: se sigue igual */
  }

  const data = await blobToBase64(blob)
  await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  try {
    await Share.share({ title: filename, dialogTitle: 'Guardar o compartir', url: uri })
  } catch (err) {
    // Cerrar el menú de compartir sin elegir nada no es un error
    if (!/cancel/i.test(String((err as Error)?.message ?? err))) throw err
  }
}

/** Guarda un PDF de jsPDF (en el celular abre el menú de compartir en lugar de descargar). */
export const savePdf = (doc: jsPDF, filename: string): Promise<void> =>
  saveFile(doc.output('blob'), filename)
