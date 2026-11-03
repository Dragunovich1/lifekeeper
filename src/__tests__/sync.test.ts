import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../types'

type Handler = (url: string, init?: RequestInit) => { status: number; body: unknown }
let handler: Handler = () => ({ status: 200, body: {} })
const calls: string[] = []

vi.mock('../services/api/apiConfig', () => ({
  apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url.split('?')[0]} ${(init?.headers as Record<string, string> | undefined)?.Authorization ?? ''}`.trim())
    const r = handler(url, init)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }
  }),
}))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})
vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' })
vi.stubGlobal('window', { crypto: globalThis.crypto, addEventListener: () => {}, removeEventListener: () => {}, btoa, atob })

const SESSION = { userId: 'u', email: 'a@b.com', token: 'viejo', salt: 'c2FsdA==', vaultVersion: 3 }

async function setup() {
  const { syncService } = await import('../services/sync/syncService')
  const { ensureAppDataShape } = await import('../utils/defaultData')
  const data = ensureAppDataShape({}) as AppData
  data.profile.auth.email = 'a@b.com'
  return { syncService, data }
}

describe('sincronización: token vencido', () => {
  beforeEach(() => {
    calls.length = 0
    store.clear()
    store.set('lifekeeper_cloud_session_v1', JSON.stringify(SESSION))
  })

  it('vuelve a iniciar sesión solo y reintenta', async () => {
    const { syncService, data } = await setup()
    handler = (url, init) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
      if (url.startsWith('/api/auth/salt')) return { status: 200, body: { exists: true, salt: 'c2FsdA==', email: 'a@b.com' } }
      if (url.startsWith('/api/auth/login')) return { status: 200, body: { token: 'nuevo', user: { id: 'u', email: 'a@b.com' }, vault: null } }
      if (auth === 'Bearer viejo') return { status: 401, body: { error: 'Token inválido' } }
      if (init?.method === 'POST') return { status: 200, body: { version: 4, updated_at: new Date().toISOString() } }
      return { status: 200, body: { vault: null } }
    }
    const res = await syncService.syncBidirectional(data, 'Passw0rd!Test99')
    expect(res.action).toBe('pushed')
    expect(syncService.getSession()?.token).toBe('nuevo')
    expect(calls.some((c) => c.includes('/api/auth/login'))).toBe(true)
  })

  it('si el re-login también falla, informa el motivo en vez de decir "al día"', async () => {
    const { syncService, data } = await setup()
    handler = (url) => {
      if (url.startsWith('/api/auth/salt')) return { status: 200, body: { exists: true, salt: 'c2FsdA==', email: 'a@b.com' } }
      if (url.startsWith('/api/auth/login')) return { status: 401, body: { error: 'Contraseña maestra incorrecta' } }
      return { status: 401, body: { error: 'Token inválido' } }
    }
    const res = await syncService.syncBidirectional(data, 'Passw0rd!Test99')
    expect(res.action).toBe('error')
    expect(res.error).toMatch(/venció/i)
  })
})
