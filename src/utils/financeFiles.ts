import type { Cell, RawTable } from './financeImport'
import { parseCsv } from './financeImport'

export type ReadResult =
  | { kind: 'table'; tables: RawTable[] }
  | { kind: 'pdf'; lines: string[] }

const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase()

function excelCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { result?: unknown; richText?: { text: string }[]; text?: string; error?: string }
    if ('result' in v) return excelCell(v.result)
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('')
    if (typeof v.text === 'string') return v.text
  }
  return null
}

async function readExcel(buffer: ArrayBuffer): Promise<RawTable[]> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const tables: RawTable[] = []
  workbook.eachSheet((sheet) => {
    const rows: Cell[][] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      rows.push(values.map(excelCell))
    })
    if (rows.length > 0) tables.push({ name: sheet.name, rows })
  })
  return tables
}

async function readPdf(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; text: string; w: number }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      const x = item.transform[4]
      rows.set(y, [...(rows.get(y) ?? []), { x, text: item.str, w: item.width }])
    }
    const ys = [...rows.keys()].sort((a, b) => b - a)
    for (const y of ys) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x)
      let line = ''
      let lastEnd = -Infinity
      for (const it of items) {
        if (line && it.x - lastEnd > 2) line += it.x - lastEnd > 8 ? '  ' : ' '
        line += it.text
        lastEnd = it.x + it.w
      }
      lines.push(line)
    }
  }
  return lines
}

/** Lee un archivo de movimientos o resumen y lo devuelve como tablas o líneas de texto. */
export async function readFinanceFile(file: File): Promise<ReadResult> {
  const ext = extOf(file.name)
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    const text = await file.text()
    return { kind: 'table', tables: [{ name: file.name, rows: parseCsv(text) }] }
  }
  if (ext === 'xlsx' || ext === 'xlsm') return { kind: 'table', tables: await readExcel(await file.arrayBuffer()) }
  if (ext === 'xls') throw new Error('Los archivos .xls (Excel antiguo) no se pueden leer. Guardalo como .xlsx o .csv y probá de nuevo.')
  if (ext === 'pdf') {
    const lines = await readPdf(await file.arrayBuffer())
    if (lines.join('').trim().length < 20) throw new Error('No encontré texto en el PDF. Si es un resumen escaneado (una foto), descargá el archivo original desde el homebanking o usá el CSV/Excel.')
    return { kind: 'pdf', lines }
  }
  throw new Error('Formato no compatible. Podés importar CSV, Excel (.xlsx) o PDF.')
}
