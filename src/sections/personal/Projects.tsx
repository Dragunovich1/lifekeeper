import type { FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  Kanban,
  ListTodo,
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Circle,
} from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { Project, ProjectTask, ProjectTaskStatus } from '../../types'
import { formatDate } from '../../utils/dates'

const initialFormState = {
  name: '',
  description: '',
}

type TaskPriority = NonNullable<ProjectTask['priority']>

const priorityOrder: Record<TaskPriority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
}

const priorityBadgeClass: Record<TaskPriority, string> = {
  alta: 'badge badge-error',
  media: 'badge badge-warning',
  baja: 'badge badge-info',
}

const priorityLabel: Record<TaskPriority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const getTaskStatus = (task: ProjectTask): ProjectTaskStatus => {
  if (task.status) return task.status
  return task.completed ? 'done' : 'todo'
}

const sortTasks = (tasks: ProjectTask[]): ProjectTask[] => {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    const prioA = priorityOrder[a.priority ?? 'media']
    const prioB = priorityOrder[b.priority ?? 'media']
    return prioA - prioB
  })
}

export const ProjectsSection = () => {
  const { data, updateData } = useAppData()
  const projects = data.personal.projects

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [formState, setFormState] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState(initialFormState)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [newTasks, setNewTasks] = useState<Record<string, string>>({})
  const [newPriorities, setNewPriorities] = useState<Record<string, TaskPriority>>({})

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name.trim()) return

    const project: Project = {
      id: uuid(),
      name: formState.name.trim(),
      description: formState.description.trim() || undefined,
      tasks: [],
      createdAt: new Date().toISOString(),
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: [project, ...previous.personal.projects],
      },
    }))

    setFormState(initialFormState)
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.name.trim()) return

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === editingId
            ? {
                ...project,
                name: editFormState.name.trim(),
                description: editFormState.description.trim() || undefined,
              }
            : project,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (project: Project) => {
    setEditingId(project.id)
    setEditFormState({
      name: project.name,
      description: project.description ?? '',
    })
  }

  const addTask = (projectId: string, defaultStatus: ProjectTaskStatus = 'todo') => {
    const value = newTasks[projectId]?.trim()
    if (!value) return

    const priority: TaskPriority = newPriorities[projectId] ?? 'media'
    const task: ProjectTask = {
      id: uuid(),
      description: value,
      completed: defaultStatus === 'done',
      status: defaultStatus,
      priority,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === projectId
            ? { ...project, tasks: [...project.tasks, task] }
            : project,
        ),
      },
    }))

    setNewTasks((prev) => ({ ...prev, [projectId]: '' }))
    setNewPriorities((prev) => ({ ...prev, [projectId]: 'media' }))
  }

  const setTaskStatus = (projectId: string, taskId: string, nextStatus: ProjectTaskStatus) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                tasks: project.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: nextStatus,
                        completed: nextStatus === 'done',
                      }
                    : task,
                ),
              }
            : project,
        ),
      },
    }))
  }

  const toggleTask = (projectId: string, taskId: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                tasks: project.tasks.map((task) => {
                  if (task.id !== taskId) return task
                  const nextCompleted = !task.completed
                  return {
                    ...task,
                    completed: nextCompleted,
                    status: nextCompleted ? 'done' : 'todo',
                  }
                }),
              }
            : project,
        ),
      },
    }))
  }

  const removeTask = (projectId: string, taskId: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                tasks: project.tasks.filter((task) => task.id !== taskId),
              }
            : project,
        ),
      },
    }))
  }

  const removeProject = (id: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.filter((project) => project.id !== id),
      },
    }))
    setDeletingProject(null)
  }

  const completion = (project: Project) => {
    if (project.tasks.length === 0) return 0
    const done = project.tasks.filter((task) => getTaskStatus(task) === 'done').length
    return Math.round((done / project.tasks.length) * 100)
  }

  return (
    <div>
      <SectionHeader
        title="Proyectos e ideas"
        subtitle="Organizá tareas por proyecto con prioridades, listas de verificación y tablero Kanban interactivo"
      />

      <div className="section-body">
        {/* Panel Crear Proyecto */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Crear proyecto</h3>
          </div>
          <form className="form-grid" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="project-name">Nombre</label>
              <input
                id="project-name"
                value={formState.name}
                onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                placeholder="Proyecto o idea"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="project-description">Descripción</label>
              <textarea
                id="project-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
                placeholder="Alcance, notas"
              />
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Guardar proyecto
              </button>
            </div>
          </form>
        </div>

        {/* Panel Listado de Proyectos */}
        <div className="panel">
          <div
            className="panel-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}
          >
            <h3 className="panel-title">Listado de proyectos ({projects.length})</h3>

            {/* Selector de Vista: Lista vs Kanban */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className={viewMode === 'kanban' ? 'primary-button' : 'secondary-button'}
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setViewMode('kanban')}
              >
                <Kanban size={15} />
                Tablero Kanban
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'primary-button' : 'secondary-button'}
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setViewMode('list')}
              >
                <ListTodo size={15} />
                Lista Clásica
              </button>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">Todavía no cargaste proyectos.</div>
          ) : (
            <div className="section-body">
              {projects.map((project) => {
                const percent = completion(project)
                const orderedTasks = sortTasks(project.tasks)

                const todoTasks = project.tasks.filter((t) => getTaskStatus(t) === 'todo')
                const inProgressTasks = project.tasks.filter((t) => getTaskStatus(t) === 'in_progress')
                const doneTasks = project.tasks.filter((t) => getTaskStatus(t) === 'done')

                return (
                  <div key={project.id} className="subpanel" style={{ marginBottom: '1.5rem' }}>
                    {/* Header del proyecto */}
                    <div className="panel-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h3 className="panel-title" style={{ fontSize: '1.15rem' }}>{project.name}</h3>
                          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                            {doneTasks.length}/{project.tasks.length} tareas ({percent}%)
                          </span>
                        </div>
                        <p className="panel-subtitle" style={{ margin: '0.2rem 0 0' }}>
                          Creado {formatDate(project.createdAt)}
                        </p>
                        {project.description ? (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            {project.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(project)}
                        >
                          <Edit3 size={14} style={{ marginRight: '0.25rem' }} />
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingProject(project)}
                        >
                          <Trash2 size={14} style={{ marginRight: '0.25rem' }} />
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="progress-track" aria-label={`Progreso ${percent}%`} style={{ margin: '0.5rem 0 1rem' }}>
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>

                    {/* Formulario rápido para agregar tarea */}
                    <div
                      className="form-grid"
                      style={{
                        gridTemplateColumns: '1fr auto auto',
                        gap: '0.5rem',
                        marginBottom: '1rem',
                        alignItems: 'end',
                      }}
                    >
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor={`task-input-${project.id}`}>Nueva tarea para este proyecto</label>
                        <input
                          id={`task-input-${project.id}`}
                          value={newTasks[project.id] ?? ''}
                          onChange={(event) =>
                            setNewTasks({ ...newTasks, [project.id]: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              addTask(project.id)
                            }
                          }}
                          placeholder="Escribí una tarea y presioná Enter..."
                        />
                      </div>
                      <div className="field" style={{ margin: 0, width: '130px' }}>
                        <label htmlFor={`task-priority-${project.id}`}>Prioridad</label>
                        <Select
                          id={`task-priority-${project.id}`}
                          value={newPriorities[project.id] ?? 'media'}
                          onChange={(value) =>
                            setNewPriorities({
                              ...newPriorities,
                              [project.id]: value as TaskPriority,
                            })
                          }
                          options={[
                            { value: 'alta', label: 'Alta' },
                            { value: 'media', label: 'Media' },
                            { value: 'baja', label: 'Baja' },
                          ]}
                          ariaLabel="Prioridad de la tarea"
                        />
                      </div>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => addTask(project.id)}
                        style={{ height: '38px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Plus size={16} />
                        Agregar
                      </button>
                    </div>

                    {/* ============================================================== */}
                    {/* VISTA 1: TABLERO KANBAN */}
                    {/* ============================================================== */}
                    {viewMode === 'kanban' ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                          gap: '0.75rem',
                        }}
                      >
                        {/* Columna 1: Por Hacer */}
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.15)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '160px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Circle size={14} style={{ color: 'var(--color-text-muted)' }} />
                              <strong style={{ fontSize: '0.85rem' }}>Por Hacer</strong>
                            </div>
                            <span className="badge" style={{ fontSize: '0.7rem' }}>{todoTasks.length}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                            {todoTasks.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 'auto' }}>
                                Sin tareas pendientes
                              </div>
                            ) : (
                              todoTasks.map((task) => {
                                const prio: TaskPriority = task.priority ?? 'media'
                                return (
                                  <div
                                    key={task.id}
                                    style={{
                                      padding: '0.6rem 0.75rem',
                                      borderRadius: '6px',
                                      backgroundColor: 'var(--color-surface)',
                                      border: '1px solid var(--color-border)',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.4rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.3 }}>
                                        {task.description}
                                      </span>
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}
                                        onClick={() => removeTask(project.id, task.id)}
                                        title="Eliminar tarea"
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                      <span className={priorityBadgeClass[prio]} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                        {priorityLabel[prio]}
                                      </span>
                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                          type="button"
                                          className="secondary-button"
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                          onClick={() => setTaskStatus(project.id, task.id, 'in_progress')}
                                          title="Mover a En Progreso"
                                        >
                                          Iniciar <ArrowRight size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="secondary-button"
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                          onClick={() => setTaskStatus(project.id, task.id, 'done')}
                                          title="Marcar como hecha"
                                        >
                                          ✓
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>

                        {/* Columna 2: En Progreso */}
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.15)',
                            borderRadius: '8px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '160px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={14} style={{ color: 'var(--color-warning)' }} />
                              <strong style={{ fontSize: '0.85rem' }}>En Progreso</strong>
                            </div>
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{inProgressTasks.length}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                            {inProgressTasks.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 'auto' }}>
                                Nada en curso
                              </div>
                            ) : (
                              inProgressTasks.map((task) => {
                                const prio: TaskPriority = task.priority ?? 'media'
                                return (
                                  <div
                                    key={task.id}
                                    style={{
                                      padding: '0.6rem 0.75rem',
                                      borderRadius: '6px',
                                      backgroundColor: 'var(--color-surface)',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.4rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.3 }}>
                                        {task.description}
                                      </span>
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}
                                        onClick={() => removeTask(project.id, task.id)}
                                        title="Eliminar tarea"
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                      <span className={priorityBadgeClass[prio]} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                        {priorityLabel[prio]}
                                      </span>
                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                          type="button"
                                          className="secondary-button"
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                          onClick={() => setTaskStatus(project.id, task.id, 'todo')}
                                          title="Volver a Por Hacer"
                                        >
                                          <ArrowLeft size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="primary-button"
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                          onClick={() => setTaskStatus(project.id, task.id, 'done')}
                                          title="Completar tarea"
                                        >
                                          ✓ Lista
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>

                        {/* Columna 3: Completadas */}
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.15)',
                            borderRadius: '8px',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '160px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                              <strong style={{ fontSize: '0.85rem' }}>Completadas</strong>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{doneTasks.length}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                            {doneTasks.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 'auto' }}>
                                Sin tareas hechas
                              </div>
                            ) : (
                              doneTasks.map((task) => (
                                <div
                                  key={task.id}
                                  style={{
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'var(--color-surface)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                    opacity: 0.85,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.8125rem', textDecoration: 'line-through', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                                      {task.description}
                                    </span>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}
                                      onClick={() => removeTask(project.id, task.id)}
                                      title="Eliminar tarea"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}
                                      onClick={() => setTaskStatus(project.id, task.id, 'in_progress')}
                                      title="Reabrir tarea"
                                    >
                                      ↩ Reabrir
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ============================================================== */
                      /* VISTA 2: LISTA CLÁSICA */
                      /* ============================================================== */
                      orderedTasks.length === 0 ? (
                        <p className="panel-subtitle">Todavía no agregaste tareas.</p>
                      ) : (
                        <ul className="task-list">
                          {orderedTasks.map((task) => {
                            const prio: TaskPriority = task.priority ?? 'media'
                            return (
                              <li key={task.id}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={() => toggleTask(project.id, task.id)}
                                  />
                                  <span className={task.completed ? 'task-completed' : ''}>
                                    {task.description}
                                  </span>
                                </label>
                                <div className="section-actions">
                                  <span className={priorityBadgeClass[prio]}>
                                    {priorityLabel[prio]}
                                  </span>
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => removeTask(project.id, task.id)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar proyecto"
        subtitle="Actualizá el nombre y descripción del proyecto"
        maxWidth="600px"
      >
        <form className="form-grid" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-project-name">Nombre</label>
            <input
              id="edit-project-name"
              value={editFormState.name}
              onChange={(event) =>
                setEditFormState({ ...editFormState, name: event.target.value })
              }
              placeholder="Proyecto o idea"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-project-description">Descripción</label>
            <textarea
              id="edit-project-description"
              value={editFormState.description}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  description: event.target.value,
                })
              }
              placeholder="Alcance, notas"
              rows={4}
            />
          </div>
          <div
            className="form-actions"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingProject)}
        title="Eliminar proyecto"
        message={
          deletingProject
            ? `¿Querés eliminar el proyecto "${deletingProject.name}" y todas sus tareas asociadas? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar proyecto"
        onConfirm={() => {
          if (deletingProject) {
            removeProject(deletingProject.id)
          }
        }}
        onClose={() => setDeletingProject(null)}
      />
    </div>
  )
}
