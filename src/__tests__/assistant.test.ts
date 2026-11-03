import { describe, expect, it, vi } from 'vitest'
import type { AppData } from '../types'

// Ollama simulado: 1ª llamada = clasificador, 2ª = extractor
const replies: string[] = []
vi.mock('../services/api/apiConfig', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ message: { content: replies.shift() ?? '{}' } }),
  })),
}))

describe('planLlmActions · medicación', () => {
  it('guarda la medicación aunque el clasificador no la detecte (red de seguridad por pistas)', async () => {
    const { planLlmActions } = await import('../services/assistant/actionExtractor')
    const { ensureAppDataShape } = await import('../utils/defaultData')
    const data = ensureAppDataShape({}) as AppData
    replies.push(
      '{"types":[]}',
      JSON.stringify({ actions: [{ type: 'medication_add', name: 'Noster 5/160', dosage: '5/160 mg', frequency: '1 vez al día', times: ['11:30'] }] }),
    )
    const res = await planLlmActions('cargame la medicacion noster 5/160 amlodipina/valsartan 1 vez al dia a las 11:30', [], 'm', data)
    expect(res).not.toBeNull()
    expect(res!.message.text).toContain('quedó guardado')
    const next = res!.updater(data)
    expect(next.health.medications[0]).toMatchObject({ name: 'Noster 5/160', schedules: [{ time: '11:30' }], active: true })
  })

  it('si no hay nada que guardar devuelve null (conversación normal)', async () => {
    const { planLlmActions } = await import('../services/assistant/actionExtractor')
    const { ensureAppDataShape } = await import('../utils/defaultData')
    replies.push('{"types":[]}', '{"actions":[]}')
    const res = await planLlmActions('qué medicación tengo hoy?', [], 'm', ensureAppDataShape({}) as AppData)
    expect(res).toBeNull()
  })
})
