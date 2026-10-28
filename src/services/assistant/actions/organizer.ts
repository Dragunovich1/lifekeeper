import type { PrivateNote, Project, ProjectTask, Reminder } from '../../../types'
import { capitalize, findByName, fmtDate, isoDate, oneOf, optionalIsoDate, str, timeOr, uid } from './helpers'
import type { ActionDef } from './types'

export const reminderAction: ActionDef = {
  type: 'reminder',
  hints: /record|agend|avisa|alarma|olvid|tengo que|tengo (un|una)|turno|cita|manana|hoy a las|a las \d|\d\s?hs/,
  schema: '{"type":"reminder","title":"...","date":"YYYY-MM-DD","time":"HH:MM","category":"salud|personal|general","details":"..."}',
  example: '"hoy a las 15:00 tengo ergometría" → {"type":"reminder","title":"Ergometría","date":"(hoy)","time":"15:00","category":"salud"}   (también turnos y eventos futuros; "recordame…" siempre es un recordatorio)',
  build(raw, { todayKey }) {
    const title = capitalize(str(raw.title, 100))
    if (!title) return null
    const date = isoDate(raw.date, todayKey)
    const time = timeOr(raw.time, '09:00')
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    const category = oneOf(raw.category, ['salud', 'personal', 'general'] as const) ?? 'general'
    const reminder: Reminder = {
      id: uid('rem'),
      title,
      details: str(raw.details, 300) || undefined,
      dateTime: new Date(y, m - 1, d, h, min, 0, 0).toISOString(),
      category,
      done: false,
    }
    return {
      apply: (prev) => ({ ...prev, utilities: { ...prev.utilities, reminders: [reminder, ...(prev.utilities.reminders ?? [])] } }),
      line: `• ⏰ **Recordatorio:** ${title} — ${fmtDate(date)} a las ${time}`,
      card: { category: 'recordatorio', title, details: `${fmtDate(date)} a las ${time}`, badge: 'Agendado', entityId: reminder.id },
      link: { label: 'Ver Recordatorios', hash: '#utilities:reminders' },
    }
  },
}

export const projectTaskAction: ActionDef = {
  type: 'project_task',
  hints: /proyecto|tarea|idea|pendiente|kanban|agrega.*lista|sumale/,
  schema: '{"type":"project_task","project":"nombre del proyecto","description":"la tarea o idea","priority":"alta|media|baja","dueDate":"YYYY-MM-DD o vacío"}',
  example: '"agregá al proyecto Casa la tarea comprar pintura, prioridad alta" → {"type":"project_task","project":"Casa","description":"Comprar pintura","priority":"alta"}',
  build(raw, { data, now }) {
    const description = capitalize(str(raw.description, 150))
    if (!description) return null
    const projects = data.personal.projects ?? []
    const projectName = str(raw.project, 80)
    let project = projectName ? findByName(projects, projectName, (p) => p.name) : projects.length === 1 ? projects[0] : null
    if (!project && !projectName) {
      return { clarify: projects.length ? `¿A qué proyecto la sumo? Tenés: ${projects.map((p) => p.name).join(', ')}.` : '¿Cómo se llama el proyecto? Si no existe, lo creo.' }
    }

    const task: ProjectTask = {
      id: uid('task'),
      description,
      completed: false,
      status: 'todo',
      priority: oneOf(raw.priority, ['alta', 'media', 'baja'] as const) ?? 'media',
      dueDate: optionalIsoDate(raw.dueDate),
    }
    const created = !project
    const newProject: Project | null = created ? { id: uid('proj'), name: capitalize(projectName), tasks: [], createdAt: now.toISOString() } : null
    const targetId = (project ?? newProject)!.id
    const targetName = (project ?? newProject)!.name

    return {
      apply: (prev) => {
        const list = newProject ? [newProject, ...(prev.personal.projects ?? [])] : prev.personal.projects ?? []
        return { ...prev, personal: { ...prev.personal, projects: list.map((p) => (p.id === targetId ? { ...p, tasks: [task, ...p.tasks] } : p)) } }
      },
      line: `• 📌 **${targetName}${created ? ' (proyecto nuevo)' : ''}:** ${description} — prioridad ${task.priority}`,
      card: { category: 'recordatorio', title: description, details: targetName, badge: 'Por hacer', entityId: task.id },
      link: { label: 'Ver Proyectos', hash: '#personal:projects' },
    }
  },
}

export const privateNoteAction: ActionDef = {
  type: 'private_note',
  hints: /nota privada|nota segura|notas privadas|nota secreta|guarda.*nota|anota.*nota/,
  schema: '{"type":"private_note","title":"...","content":"..."}',
  example: '"guardá una nota privada: el código del candado es 4821" → {"type":"private_note","title":"Código del candado","content":"El código del candado es 4821"}',
  build(raw, { now }) {
    const content = str(raw.content, 2000)
    if (!content) return null
    const iso = now.toISOString()
    const note: PrivateNote = { id: uid('pn'), title: capitalize(str(raw.title, 80)) || 'Nota del asistente', content, createdAt: iso, updatedAt: iso }
    return {
      apply: (prev) => ({ ...prev, security: { ...prev.security, privateNotes: [note, ...(prev.security.privateNotes ?? [])] } }),
      line: `• 🔒 **Nota privada:** ${note.title}`,
      card: { category: 'diario', title: note.title, details: 'Nota privada cifrada', badge: 'Guardada', entityId: note.id },
      link: { label: 'Ver Notas Privadas', hash: '#security:private-notes' },
    }
  },
}

export const ORGANIZER_ACTIONS = [reminderAction, projectTaskAction, privateNoteAction]

