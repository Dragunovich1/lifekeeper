import { describe, expect, it } from 'vitest'
import { countryByCode, matchCountry, matchRegion, norm, regionsFor, searchCountries, searchOfflinePlaces, searchRegions } from '../data/places'

describe('países', () => {
  it('predice a medida que se escribe, sin importar tildes ni mayúsculas', () => {
    expect(searchCountries('arg')[0].code).toBe('AR')
    expect(searchCountries('ESPAN')[0].code).toBe('ES')
    expect(searchCountries('mex')[0].code).toBe('MX')
    expect(searchCountries('uru').map((c) => c.code)).toContain('UY')
  })
  it('entiende siglas y apodos', () => {
    expect(searchCountries('eeuu')[0].code).toBe('US')
    expect(searchCountries('holanda')[0].code).toBe('NL')
    expect(matchCountry('Argentina')?.code).toBe('AR')
    expect(matchCountry('  argéntina ')?.code).toBe('AR')
    expect(matchCountry('xx raro')).toBeUndefined()
  })
  it('sin texto sugiere los países de la región primero', () => {
    expect(searchCountries('').slice(0, 3).map((c) => c.code)).toEqual(['AR', 'UY', 'CL'])
  })
  it('usa nombres en español', () => {
    expect(countryByCode('US')?.name).toBe('Estados Unidos')
    expect(countryByCode('GB')?.name).toBe('Reino Unido')
  })
})

describe('provincias y estados', () => {
  it('Argentina tiene sus 24 jurisdicciones', () => {
    expect(regionsFor('AR')).toHaveLength(24)
  })
  it('filtra y entiende abreviaturas', () => {
    expect(searchRegions('AR', 'cord')[0]).toBe('Córdoba')
    expect(searchRegions('AR', 'tucu')).toEqual(['Tucumán'])
    expect(matchRegion('AR', 'CABA')).toBe('Ciudad Autónoma de Buenos Aires')
    expect(matchRegion('AR', 'bs as')).toBe('Buenos Aires')
    expect(matchRegion('ES', 'cataluna')).toBe('Cataluña')
  })
  it('países sin lista devuelven vacío (la app deja escribir libre)', () => {
    expect(regionsFor('JP')).toEqual([])
  })
})

describe('ciudades sin conexión', () => {
  it('encuentra por prefijo y respeta el país', () => {
    expect(searchOfflinePlaces('quil')[0]).toMatchObject({ name: 'Quilmes', admin1: 'Buenos Aires', countryCode: 'AR' })
    expect(searchOfflinePlaces('monte ch')[0].name).toBe('Monte Chingolo')
    expect(searchOfflinePlaces('san', { countryCode: 'UY' }).every((p) => p.countryCode === 'UY')).toBe(true)
    expect(searchOfflinePlaces('a')).toEqual([])
  })
  it('prioriza la provincia elegida', () => {
    const r = searchOfflinePlaces('san', { countryCode: 'AR', admin1: 'Mendoza', limit: 10 })
    expect(r[0].admin1).toBe('Mendoza')
  })
  it('norm quita tildes', () => {
    expect(norm('Tucumán')).toBe('tucuman')
  })
})
