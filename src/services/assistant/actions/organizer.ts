import type { PrivateNote, Project, ProjectTask, QuickNote, Reminder, ShoppingItem, ShoppingList } from '../../../types'
import { guessCategory, normalizeProductKey } from '../../../utils/shopping'
import { capitalize, findByName, fmtDate, isoDate, oneOf, optionalIsoDate, str, timeOr, uid } from './helpers'
import type { ActionDef } from './types'

export const reminderAction: ActionDef = {
  type: 'reminder',
  about: 'quiere que se lo recuerden o cuenta un turno/evento futuro con fecha u hora',
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
  about: 'quiere sumar una tarea o idea a un proyecto',
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
  about: 'quiere guardar una nota privada o un dato reservado',
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

export const shoppingAddAction: ActionDef = {
  type: 'shopping_add',
  about: 'quiere sumar productos a la lista de compras o del súper',
  hints: /lista de compras|lista del super|comprar|super\b|hay que comprar|falta|se acabo|se termino|sumale a la lista|anota.*(leche|pan)|necesito (comprar|un|una)/,
  schema: '{"type":"shopping_add","list":"nombre de la lista o vacío","items":[{"name":"...","quantity":número,"unit":"u|kg|g|l|ml|paq","price":precio unitario o vacío}]}',
  example: '"se acabó la leche y el pan, sumá 2 kilos de tomates a la lista" → {"type":"shopping_add","items":[{"name":"Leche","quantity":1,"unit":"u"},{"name":"Pan","quantity":1,"unit":"u"},{"name":"Tomates","quantity":2,"unit":"kg"}]}',
  build(raw, { data, now }) {
    const rawItems = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []
    const memory = data.personal.shopping?.priceMemory ?? {}
    const items: ShoppingItem[] = rawItems.slice(0, 20).flatMap((r) => {
      const name = capitalize(str(r.name, 60))
      if (!name) return []
      const given = typeof r.price === 'number' ? r.price : parseFloat(String(r.price ?? ''))
      const unit = oneOf(r.unit, ['kg', 'g', 'l', 'ml', 'paq'] as const)
      return [{
        id: uid('shop'),
        name,
        quantity: typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 1,
        unit: unit ?? undefined,
        price: Number.isFinite(given) && given > 0 ? given : memory[normalizeProductKey(name)]?.price,
        category: guessCategory(name),
        checked: false,
        addedAt: now.toISOString(),
      }]
    })
    if (items.length === 0) return null

    const lists = data.personal.shopping?.lists ?? []
    const wanted = str(raw.list, 60)
    const existing = (wanted ? findByName(lists, wanted, (l) => l.name) : null) ?? lists.find((l) => l.id === data.personal.shopping?.activeListId) ?? lists[0] ?? null
    const target: ShoppingList = existing ?? { id: uid('list'), name: capitalize(wanted) || 'Compras', items: [], currency: 'ARS', createdAt: now.toISOString() }
    const listName = target.name

    return {
      apply: (prev) => {
        const shopping = prev.personal.shopping ?? { lists: [], priceMemory: {} }
        const has = shopping.lists.some((l) => l.id === target.id)
        const lists = (has ? shopping.lists : [...shopping.lists, { ...target, items: [] }]).map((l) => (l.id === target.id ? { ...l, items: [...items, ...l.items] } : l))
        return { ...prev, personal: { ...prev.personal, shopping: { ...shopping, lists, activeListId: shopping.activeListId ?? target.id } } }
      },
      line: `• 🛒 **${listName}:** ${items.map((i) => `${i.quantity !== 1 || i.unit ? `${i.quantity}${i.unit ? ` ${i.unit}` : ''} ` : ''}${i.name}`).join(', ')}`,
      card: { category: 'recordatorio', title: `${items.length} ${items.length === 1 ? 'producto' : 'productos'} a la lista`, details: items.map((i) => i.name).join(', ').slice(0, 60), badge: 'Compras', entityId: items[0].id },
      link: { label: 'Ver Lista de Compras', hash: '#utilities:shopping' },
    }
  },
}

export const quickNoteAction: ActionDef = {
  type: 'quick_note',
  about: 'quiere anotar algo rápido (una nota suelta, un apunte, un dato para no olvidarse) que no es un recordatorio con fecha ni un dato reservado',
  hints: /anotame|apunta|anota (que|esto)|nota rapida|para no olvidar|tene en cuenta|dejame anotado/,
  schema: '{"type":"quick_note","text":"contenido de la nota","color":"amarillo|verde|azul|rosa|violeta|gris"}',
  example: '"anotame que el wifi de lo de mamá es casa1234" → {"type":"quick_note","text":"El wifi de lo de mamá es casa1234","color":"amarillo"}   (si tiene fecha u hora, es un recordatorio; si es algo secreto, una nota privada)',
  build(raw, { now }) {
    const text = str(raw.text, 1500)
    if (!text) return null
    const note: QuickNote = {
      id: uid('qn'),
      text: capitalize(text),
      color: oneOf(raw.color, ['amarillo', 'verde', 'azul', 'rosa', 'violeta', 'gris'] as const) ?? 'amarillo',
      pinned: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    return {
      apply: (prev) => ({ ...prev, utilities: { ...prev.utilities, quickNotes: [note, ...(prev.utilities.quickNotes ?? [])] } }),
      line: `• 📝 **Nota rápida:** ${note.text.length > 90 ? note.text.slice(0, 90) + '…' : note.text}`,
      card: { category: 'diario', title: 'Nota rápida', details: note.text.slice(0, 60), badge: 'Guardada', entityId: note.id },
      link: { label: 'Ver Notas Rápidas', hash: '#utilities:quick-notes' },
    }
  },
}

export const ORGANIZER_ACTIONS = [reminderAction, projectTaskAction, privateNoteAction, shoppingAddAction, quickNoteAction]

