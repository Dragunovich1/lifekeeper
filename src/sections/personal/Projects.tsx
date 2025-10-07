import type { FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { Project, ProjectTask } from '../../types'
import { formatDate } from '../../utils/dates'

const initialFormState = {
  name: '',
  description: '',
}

export const ProjectsSection = () => {
  const { data, updateData } = useAppData()
  const projects = data.personal.projects
  const [formState, setFormState] = useState(initialFormState)
  const [newTasks, setNewTasks] = useState<Record<string, string>>({})

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name) {
      return
    }

    const project: Project = {
      id: uuid(),
      name: formState.name,
      description: formState.description || undefined,
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

  const addTask = (projectId: string) => {
    const value = newTasks[projectId]?.trim()
    if (!value) {
      return
    }

    const task: ProjectTask = {
      id: uuid(),
      description: value,
      completed: false,
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
        subtitle="Organiza tareas por proyecto con listas de verificacion"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Crear proyecto</h3>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
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
              <label htmlFor="project-description">Descripcion</label>
              <textarea
                id="project-description"
                value={formState.description}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                placeholder="Alcance, notas"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar proyecto
            </button>
          </form>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">Todavia no cargaste proyectos.</div>
        ) : (
          <div className="section-body">
            {projects.map((project) => (
              <div key={project.id} className="panel">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">{project.name}</h3>
                    <p className="panel-subtitle">
                      Creado {formatDate(project.createdAt)} · {completion(project)}% completado
                    </p>
                    {project.description ? <p>{project.description}</p> : null}
                  </div>
                  <button className="secondary-button" type="button" onClick={() => removeProject(project.id)}>
                    Eliminar proyecto
                  </button>
                </div>
                <div className="form-grid two-columns">
                  <div className="field">
                    <label htmlFor={`task-input-${project.id}`}>Nueva tarea</label>
                    <input
                      id={`task-input-${project.id}`}
                      value={newTasks[project.id] ?? ''}
                      onChange={(event) => setNewTasks({ ...newTasks, [project.id]: event.target.value })}
                      placeholder="Tarea pendiente"
                    />
                  </div>
                  <button className="secondary-button" type="button" onClick={() => addTask(project.id)}>
                    Agregar tarea
                  </button>
                </div>
                {project.tasks.length === 0 ? (
                  <p className="panel-subtitle">Aun no agregaste tareas.</p>
                ) : (
                  <ul className="task-list">
                    {project.tasks.map((task) => (
                      <li key={task.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(project.id, task.id)}
                          />
                          <span className={task.completed ? 'task-completed' : ''}>{task.description}</span>
                        </label>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => removeTask(project.id, task.id)}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
