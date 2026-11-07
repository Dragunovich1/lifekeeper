import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VaccineSchedulePanel } from '../components/VaccineSchedulePanel'
import type { VaccineRecord } from '../types'

const noop = () => {}
const rec = (vaccine: string, date: string): VaccineRecord => ({ id: vaccine + date, vaccine, dose: '', date, location: '', lot: '', reminderEnabled: false })

describe('VaccineSchedulePanel', () => {
  it('pide la fecha de nacimiento si falta', () => {
    const html = renderToStaticMarkup(<VaccineSchedulePanel records={[]} onRegister={noop} />)
    expect(html).toContain('fecha de nacimiento')
  })

  it('en Argentina muestra el Calendario Nacional y los pendientes', () => {
    const birth = new Date(); birth.setMonth(birth.getMonth() - 5)
    const html = renderToStaticMarkup(<VaccineSchedulePanel birthDate={birth.toISOString()} countryCode="AR" records={[]} onRegister={noop} />)
    expect(html).toContain('Calendario Nacional de Vacunación (Argentina)')
    expect(html).toContain('Rotavirus')
    expect(html).toContain('argentina.gob.ar')
    expect(html).toContain('Registrar')
  })

  it('fuera de Argentina usa la referencia OMS/CDC y las vacunas cargadas figuran como aplicadas', () => {
    const birth = new Date(); birth.setMonth(birth.getMonth() - 3)
    const applied = new Date(); applied.setDate(applied.getDate() - 30)
    const html = renderToStaticMarkup(<VaccineSchedulePanel birthDate={birth.toISOString()} countryCode="ES" records={[rec('Rotavirus', applied.toISOString())]} onRegister={noop} />)
    expect(html).toContain('Referencia internacional (OMS / CDC)')
    expect(html).toContain('who.int')
    expect(html).toContain('Aplicada el')
  })
})
