import type { FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { Project, ProjectTask } from '../../types'
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

  const addTask = (projectId: string) => {
    const value = newTasks[projectId]?.trim()
    if (!value) {
      return
    }

    const priority: TaskPriority = newPriorities[projectId] ?? 'media'
    const task: ProjectTask = {
      id: uuid(),
      description: value,
      completed: false,
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

  const toggleTask = (projectId: string, taskId: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                tasks: project.tasks.map((task) =>
                  task.id === taskId ? { ...task, completed: !task.completed } : task,
                ),
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

  const removeProject = (projectId: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        projects: previous.personal.projects.filter((project) => project.id !== projectId),
      },
    }))
    if (editingId === projectId) {
      setEditingId(null)
    }
  }

  const completion = (project: Project) => {
    if (project.tasks.length === 0) {
      return 0
    }
    const done = project.tasks.filter((task) => task.completed).length
    return Math.round((done / project.tasks.length) * 100)
  }

  return (
    <div>
      <SectionHeader
        title="Proyectos e ideas"
        subtitle="Organizá tareas por proyecto con prioridades y listas de verificación"
      />

      <div className="section-body">
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

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Listado de proyectos</h3>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">Todavía no cargaste proyectos.</div>
          ) : (
            <div className="section-body">
              {projects.map((project) => {
                const percent = completion(project)
                const orderedTasks = sortTasks(project.tasks)
                return (
                  <div key={project.id} className="subpanel">
                    <div className="panel-header">
                      <div>
                        <h3 className="panel-title">{project.name}</h3>
                        <p className="panel-subtitle">
                          Creado {formatDate(project.createdAt)} · {percent}% completado
                        </p>
                        {project.description ? <p>{project.description}</p> : null}
                      </div>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(project)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingProject(project)}
                        >
                          Eliminar proyecto
                        </button>
                      </div>
                    </div>
                    <div className="progress-track" aria-label={`Progreso ${percent}%`}>
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="form-grid three-columns">
                      <div className="field">
                        <label htmlFor={`task-input-${project.id}`}>Nueva tarea</label>
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
                          placeholder="Tarea pendiente (Enter para agregar)"
                        />
                      </div>
                      <div className="field">
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
                        className="secondary-button"
                        type="button"
                        onClick={() => addTask(project.id)}
                      >
                        Agregar tarea
                      </button>
                    </div>
                    {orderedTasks.length === 0 ? (
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
