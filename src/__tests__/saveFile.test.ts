import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = { value: true }
vi.mock('../services/platform', () => ({ isNativePlatform: () => native.value }))

const written: Array<{ path: string; data: string }> = []
const shared: Array<{ url: string }> = []
let shareError: Error | null = null
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    readdir: vi.fn(async () => ({ files: [{ name: 'viejo.json', type: 'file', mtime: 1 }, { name: 'foto.png', type: 'file', mtime: 1 }] })),
    deleteFile: vi.fn(async () => undefined),
    writeFile: vi.fn(async (o: { path: string; data: string }) => void written.push(o)),
    getUri: vi.fn(async (o: { path: string }) => ({ uri: `file:///cache/${o.path}` })),
  },
}))
vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn(async (o: { url: string }) => { if (shareError) throw shareError; shared.push(o) }) },
}))
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

class FakeReader {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  error = null
  readAsDataURL(blob: Blob) {
    void blob.text().then((t) => { this.result = `data:application/octet-stream;base64,${Buffer.from(t).toString('base64')}`; this.onload?.() })
  }
}
vi.stubGlobal('FileReader', FakeReader)

describe('saveFile', () => {
  beforeEach(() => { written.length = 0; shared.length = 0; shareError = null; native.value = true })

  it('en la APK escribe en el caché y abre el menú de compartir', async () => {
    const { saveFile } = await import('../utils/saveFile')
    await saveFile(new Blob(['hola']), 'backup.json')
    expect(written).toEqual([{ path: 'backup.json', data: Buffer.from('hola').toString('base64'), directory: 'CACHE' }])
    expect(shared[0].url).toBe('file:///cache/backup.json')
  })

  it('cerrar el menú de compartir no es un error, pero otros fallos sí', async () => {
    const { saveFile } = await import('../utils/saveFile')
    shareError = new Error('Share canceled')
    await expect(saveFile(new Blob(['x']), 'a.csv')).resolves.toBeUndefined()
    shareError = new Error('boom')
    await expect(saveFile(new Blob(['x']), 'b.csv')).rejects.toThrow('boom')
  })

  it('en la web usa la descarga normal', async () => {
    native.value = false
    const { saveFile } = await import('../utils/saveFile')
    const { saveAs } = await import('file-saver')
    await saveFile(new Blob(['x']), 'c.xlsx')
    expect(saveAs).toHaveBeenCalled()
    expect(written).toHaveLength(0)
  })
})
