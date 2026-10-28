import type { ClinicalNote, MedicalConsultation, Medication, Reminder, VaccineRecord } from '../../../types'
import { capitalize, fmtDate, findByName, isoDate, normalizeText, oneOf, optionalIsoDate, str, timeOr, uid } from './helpers'
import type { ActionDef } from './types'

const CLINICAL_TAGS = ['Estudio', 'Laboratorio', 'Diagnóstico', 'Cirugía', 'Odontología', 'Oftalmología', 'Cardiología', 'Traumatología'] as const

const reminderAt = (dateKey: string, time: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString()
}

// ---------------------------------------------------------------------------
// Toma de medicación
// ---------------------------------------------------------------------------
export const medicationTakenAction: ActionDef = {
  type: 'medication_taken',
  about: 'se tomó un medicamento que ya tiene cargado',
  hints: /pastilla|remedio|medic|tome|tomo|comprimido|dosis|antibiotic|ibuprof|paracetam|\bmg\b|tratamiento|pildora/,
  schema: '{"type":"medication_taken","name":"nombre de un medicamento ya cargado","time":"HH:MM o vacío"}',
  example: '"ya me tomé el ibuprofeno" → {"type":"medication_taken","name":"Ibuprofeno"}',
  local(text, { data }) {
    const n = normalizeText(text)
    if (!/\b(tome|me tome|tomo|ya tome|me medique)\b/.test(n)) return null
    const med = data.health.medications.find((m) => m.active && normalizeText(m.name).length > 2 && n.includes(normalizeText(m.name)))
    return med ? [{ type: 'medication_taken', name: med.name }] : null
  },
  build(raw, { data, now, todayKey }) {
    const active = data.health.medications.filter((m) => m.active)
    const med = findByName(active, str(raw.name, 60), (m) => m.name)
    if (!med) {
      return { clarify: active.length ? `No encuentro ese medicamento. Tenés cargados: ${active.map((m) => m.name).join(', ')}.` : 'No tenés medicación activa cargada. Decime nombre, dosis y horarios y la cargo.' }
    }

    const nowMin = now.getHours() * 60 + now.getMinutes()
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    const wanted = str(raw.time, 5)
    const pending = med.schedules.filter((s) => !med.intakeLog?.includes(`${todayKey}T${s.time}`))
    const pool = pending.length ? pending : med.schedules
    const slot = (wanted && med.schedules.find((s) => s.time === timeOr(wanted, ''))) || [...pool].sort((a, b) => Math.abs(toMin(a.time) - nowMin) - Math.abs(toMin(b.time) - nowMin))[0]
    const time = slot?.time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const key = `${todayKey}T${time}`

    return {
      apply: (prev) => ({
        ...prev,
        health: {
          ...prev.health,
          medications: prev.health.medications.map((m) => (m.id === med.id && !(m.intakeLog ?? []).includes(key) ? { ...m, intakeLog: [...(m.intakeLog ?? []), key] } : m)),
        },
      }),
      line: `• 💊 **Toma registrada:** ${med.name} (${med.dosage}) — dosis de las ${time}`,
      card: { category: 'salud', title: `Toma de ${med.name}`, details: `Dosis de las ${time}`, badge: 'Tomada', entityId: med.id },
      link: { label: 'Ver Medicación', hash: '#health:medications' },
    }
  },
}

export const medicationAddAction: ActionDef = {
  type: 'medication_add',
  about: 'empieza o le recetaron un medicamento o tratamiento nuevo',
  hints: /empece|empiezo|me recetaron|me indicaron|tengo que tomar|tratamiento|antibiotic|\bmg\b|cada \d+ horas/,
  schema: '{"type":"medication_add","name":"...","dosage":"ej. 500 mg","frequency":"ej. cada 8 horas","times":["08:00","16:00"],"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD o vacío","instructions":"..."}',
  example: '"me recetaron amoxicilina 500 mg cada 8 horas por 7 días" → {"type":"medication_add","name":"Amoxicilina","dosage":"500 mg","frequency":"Cada 8 horas","times":["08:00","16:00","00:00"],"endDate":"(hoy + 7 días)"}',
  build(raw, { todayKey }) {
    const name = capitalize(str(raw.name, 60))
    if (!name) return null
    const times = (Array.isArray(raw.times) ? raw.times : []).map((t) => timeOr(t, '')).filter(Boolean).slice(0, 8)
    const med: Medication = {
      id: uid('med'),
      name,
      dosage: str(raw.dosage, 40) || 'Según indicación',
      frequency: str(raw.frequency, 60) || 'Según indicación',
      schedules: (times.length ? times : ['09:00']).map((time) => ({ time })),
      startDate: isoDate(raw.startDate, todayKey),
      endDate: optionalIsoDate(raw.endDate),
      instructions: str(raw.instructions, 200) || undefined,
      active: true,
      intakeLog: [],
    }
    return {
      apply: (prev) => ({ ...prev, health: { ...prev.health, medications: [med, ...prev.health.medications] } }),
      line: `• 💊 **Medicación nueva:** ${med.name} ${med.dosage} — ${med.frequency} (${med.schedules.map((s) => s.time).join(', ')})${med.endDate ? ` hasta ${fmtDate(med.endDate)}` : ''}`,
      card: { category: 'salud', title: med.name, details: `${med.dosage} · ${med.frequency}`, badge: 'Medicación', entityId: med.id },
      link: { label: 'Ver Medicación', hash: '#health:medications' },
    }
  },
}

// ---------------------------------------------------------------------------
// Vacunas y consultas
// ---------------------------------------------------------------------------
export const vaccineAction: ActionDef = {
  type: 'vaccine',
  about: 'se aplicó una vacuna',
  hints: /vacun|refuerzo|antigripal|antitetanica|dosis/,
  schema: '{"type":"vaccine","vaccine":"...","dose":"ej. 2da dosis","date":"YYYY-MM-DD","location":"...","nextDoseDate":"YYYY-MM-DD o vacío"}',
  example: '"hoy me puse la antigripal" → {"type":"vaccine","vaccine":"Antigripal","dose":"Dosis única","date":"(hoy)"}',
  build(raw, { todayKey }) {
    const name = capitalize(str(raw.vaccine, 60))
    if (!name) return null
    const next = optionalIsoDate(raw.nextDoseDate)
    const rec: VaccineRecord = {
      id: uid('vac'),
      vaccine: name,
      dose: str(raw.dose, 40) || 'Dosis única',
      date: isoDate(raw.date, todayKey),
      location: str(raw.location, 80),
      lot: '',
      nextDoseDate: next,
      reminderEnabled: Boolean(next),
    }
    const reminder: Reminder | null = next
      ? { id: uid('rem'), title: `Próxima dosis: ${name}`, dateTime: reminderAt(next, '09:00'), category: 'salud', done: false, sourceId: rec.id, sourceType: 'vaccine' }
      : null
    return {
      apply: (prev) => ({
        ...prev,
        health: { ...prev.health, vaccines: [rec, ...prev.health.vaccines] },
        utilities: reminder ? { ...prev.utilities, reminders: [reminder, ...(prev.utilities.reminders ?? [])] } : prev.utilities,
      }),
      line: `• 💉 **Vacuna:** ${name} (${rec.dose}) — ${fmtDate(rec.date)}${next ? ` · próxima dosis ${fmtDate(next)}` : ''}`,
      card: { category: 'salud', title: name, details: `${rec.dose} · ${fmtDate(rec.date)}`, badge: 'Vacuna', entityId: rec.id },
      link: { label: 'Ver Vacunas', hash: '#health:vaccines' },
    }
  },
}

export const consultationAction: ActionDef = {
  type: 'consultation',
  about: 'fue a una consulta médica (ya realizada)',
  hints: /consulta|doctor|medic[oa]\b|dra?\b|control|especialista|fui al|cardiolog|dentista|odontolog|pediatra|clinico|dermat|ginecolog/,
  schema: '{"type":"consultation","doctor":"...","reason":"...","date":"YYYY-MM-DD","diagnosis":"...","treatment":"...","nextVisitDate":"YYYY-MM-DD o vacío"}',
  example: '"hoy fui al cardiólogo, me dijo que todo bien, control en 6 meses" → {"type":"consultation","doctor":"Cardiólogo","reason":"Control","date":"(hoy)","diagnosis":"Todo bien","nextVisitDate":"(hoy + 6 meses)"}   (solo consultas ya realizadas; un turno futuro es un recordatorio)',
  build(raw, { todayKey }) {
    const reason = capitalize(str(raw.reason, 120))
    const doctor = capitalize(str(raw.doctor, 80))
    if (!reason && !doctor) return null
    const next = optionalIsoDate(raw.nextVisitDate)
    const c: MedicalConsultation = {
      id: uid('cons'),
      date: isoDate(raw.date, todayKey),
      doctor: doctor || 'Sin especificar',
      reason: reason || 'Consulta',
      diagnosis: str(raw.diagnosis, 300) || undefined,
      treatment: str(raw.treatment, 300) || undefined,
      nextVisitDate: next,
    }
    const reminder: Reminder | null = next
      ? { id: uid('rem'), title: `Próxima consulta: ${c.doctor}`, dateTime: reminderAt(next, '09:00'), category: 'salud', done: false, sourceId: c.id, sourceType: 'consultation' }
      : null
    return {
      apply: (prev) => ({
        ...prev,
        health: { ...prev.health, consultations: [c, ...prev.health.consultations] },
        utilities: reminder ? { ...prev.utilities, reminders: [reminder, ...(prev.utilities.reminders ?? [])] } : prev.utilities,
      }),
      line: `• 🩺 **Consulta:** ${c.doctor} — ${c.reason} (${fmtDate(c.date)})${next ? ` · próximo control ${fmtDate(next)}` : ''}`,
      card: { category: 'salud', title: `Consulta: ${c.doctor}`, details: c.reason, badge: 'Consulta', entityId: c.id },
      link: { label: 'Ver Consultas', hash: '#health:consultations' },
    }
  },
}

export const clinicalNoteAction: ActionDef = {
  type: 'clinical_note',
  about: 'quiere guardar un estudio, análisis, diagnóstico o cirugía en su historial clínico',
  hints: /estudio|historial|clinic|laboratorio|diagnostic|analisis|resonancia|ecograf|radiograf|ergometr|electro|tomograf|cirugia|operacion|ficha medica/,
  schema: '{"type":"clinical_note","title":"...","description":"...","date":"YYYY-MM-DD","tags":["Estudio"]}',
  example: '"cargá la ergometría en estudios médicos" → {"type":"clinical_note","title":"Ergometría","description":"Prueba de esfuerzo","date":"(hoy)","tags":["Estudio","Cardiología"]}   (solo si pide cargar un estudio/diagnóstico/cirugía en el historial clínico)',
  build(raw, { todayKey }) {
    const title = capitalize(str(raw.title, 80))
    if (!title) return null
    const tags = (Array.isArray(raw.tags) ? raw.tags : []).map(String).filter((t): t is (typeof CLINICAL_TAGS)[number] => (CLINICAL_TAGS as readonly string[]).includes(t))
    const note: ClinicalNote = {
      id: uid('note'),
      title,
      description: str(raw.description, 600) || title,
      date: isoDate(raw.date, todayKey),
      tags: tags.length ? tags : ['Estudio'],
    }
    return {
      apply: (prev) => ({ ...prev, health: { ...prev.health, clinicalNotes: [note, ...prev.health.clinicalNotes] } }),
      line: `• 🩺 **Historial clínico (${note.tags!.join(', ')}):** ${title} — ${fmtDate(note.date)}`,
      card: { category: 'salud', title, details: `Historial clínico · ${note.tags!.join(', ')}`, badge: 'Guardado', entityId: note.id },
      link: { label: 'Ver Historial Clínico', hash: '#health:history' },
    }
  },
}

// ---------------------------------------------------------------------------
// Ciclo menstrual (solo perfil femenino)
// ---------------------------------------------------------------------------
export const menstrualAction: ActionDef = {
  type: 'menstrual',
  about: 'empezó o terminó el período menstrual',
  hints: /period|regla|menstru|ciclo|colico|ovula|sangr|me vino|me bajo/,
  schema: '{"type":"menstrual","event":"start|end","date":"YYYY-MM-DD","flow":"ligero|moderado|abundante|manchado","symptoms":["Cólicos"]}',
  example: '"hoy me vino la regla, con cólicos" → {"type":"menstrual","event":"start","date":"(hoy)","flow":"moderado","symptoms":["Cólicos"]}',
  build(raw, { data, todayKey }) {
    if (data.profile.gender !== 'Femenino') return null
    const event = raw.event === 'end' ? 'end' : 'start'
    const date = isoDate(raw.date, todayKey)
    const flow = oneOf(raw.flow, ['ligero', 'moderado', 'abundante', 'manchado'] as const) ?? undefined
    const symptoms = (Array.isArray(raw.symptoms) ? raw.symptoms : []).map((s) => str(s, 40)).filter(Boolean).slice(0, 8)
    const base = data.health.menstrualCycle ?? { enabled: true, averageCycleDays: 28, averagePeriodDays: 5, entries: [] }

    if (event === 'end') {
      const open = [...base.entries].sort((a, b) => b.startDate.localeCompare(a.startDate)).find((e) => !e.endDate)
      if (!open) return { clarify: 'No tengo un período en curso para cerrar. ¿Querés que registre el inicio de uno?' }
      return {
        apply: (prev) => {
          const cycle = prev.health.menstrualCycle ?? base
          return { ...prev, health: { ...prev.health, menstrualCycle: { ...cycle, entries: cycle.entries.map((e) => (e.id === open.id ? { ...e, endDate: date } : e)) } } }
        },
        line: `• 🌸 **Fin del período:** ${fmtDate(date)}`,
        card: { category: 'salud', title: 'Fin del período', details: fmtDate(date), badge: 'Ciclo', entityId: open.id },
        link: { label: 'Ver Ciclo', hash: '#health:menstrual' },
      }
    }

    const entry = { id: uid('cyc'), startDate: date, flow, symptoms: symptoms.length ? symptoms : undefined }
    return {
      apply: (prev) => {
        const cycle = prev.health.menstrualCycle ?? base
        return { ...prev, health: { ...prev.health, menstrualCycle: { ...cycle, enabled: true, lastPeriodStart: date, entries: [entry, ...cycle.entries] } } }
      },
      line: `• 🌸 **Inicio del período:** ${fmtDate(date)}${flow ? ` (flujo ${flow})` : ''}${symptoms.length ? ` — ${symptoms.join(', ')}` : ''}`,
      card: { category: 'salud', title: 'Inicio del período', details: fmtDate(date), badge: 'Ciclo', entityId: entry.id },
      link: { label: 'Ver Ciclo', hash: '#health:menstrual' },
    }
  },
}

export const HEALTH_ACTIONS = [medicationTakenAction, medicationAddAction, vaccineAction, consultationAction, clinicalNoteAction, menstrualAction]

