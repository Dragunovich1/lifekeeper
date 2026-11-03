import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import type { WorkoutExercise } from '../../../types'
import { buildBlocks, moveBlock, replaceGroup, ungroup } from '../../../utils/workoutGroups'
import { ExerciseCard } from './ExerciseCard'
import { AddItemModal } from './ExerciseItemAdder'
import { ExerciseGroupCard } from './GroupCards'

interface Props {
  exercises: WorkoutExercise[]
  onChange: (next: WorkoutExercise[]) => void
  weightUnit: string
  suggestions?: string[]
  emptyText?: string
}

/** Lista de ítems (ejercicios y biseries/triseries/circuitos) con "Agregar" en un modal y reordenar. */
export function ItemsEditor({ exercises, onChange, weightUnit, suggestions, emptyText = 'Todavía no hay ejercicios.' }: Props) {
  const [adding, setAdding] = useState(false)
  const blocks = buildBlocks(exercises)

  const move = (bi: number, dir: -1 | 1) => onChange(moveBlock(exercises, bi, dir))

  return (
    <div className="wk-items">
      <div className="wk-items-bar">
        <span className="wk-items-count">
          {exercises.length} ejercicio{exercises.length === 1 ? '' : 's'}
          {blocks.length !== exercises.length ? ` · ${blocks.length} ítems` : ''}
        </span>
        <button type="button" className="primary-button wk-small" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden /> Agregar ejercicio o ítem
        </button>
      </div>

      {blocks.length === 0 ? <p className="wk-items-empty">{emptyText}</p> : null}

      <div className="wk-items-list">
        {blocks.map((block, bi) => (
          <div key={block.kind === 'group' ? block.groupId : exercises[block.index].id} className="wk-item-row">
            <div className="wk-item-move" role="group" aria-label={`Ordenar ítem ${bi + 1}`}>
              <button type="button" className="secondary-button wk-icon-btn" disabled={bi === 0} onClick={() => move(bi, -1)} aria-label="Subir"><ArrowUp size={14} aria-hidden /></button>
              <button type="button" className="secondary-button wk-icon-btn" disabled={bi === blocks.length - 1} onClick={() => move(bi, 1)} aria-label="Bajar"><ArrowDown size={14} aria-hidden /></button>
            </div>
            <div className="wk-item-body">
              {block.kind === 'group' ? (
                (() => {
                  const members = block.indices.map((i) => exercises[i])
                  return (
                    <ExerciseGroupCard
                      members={members}
                      weightUnit={weightUnit}
                      onChange={(next) => onChange(replaceGroup(exercises, block.groupId, next))}
                      onUngroup={() => onChange(replaceGroup(exercises, block.groupId, ungroup(members)))}
                      onRemove={() => onChange(replaceGroup(exercises, block.groupId, null))}
                    />
                  )
                })()
              ) : (
                <ExerciseCard
                  exercise={exercises[block.index]}
                  index={bi}
                  weightUnit={weightUnit}
                  onChange={(ex) => onChange(exercises.map((e, i) => (i === block.index ? ex : e)))}
                  onRemove={() => onChange(exercises.filter((_, i) => i !== block.index))}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <AddItemModal open={adding} onClose={() => setAdding(false)} newId={uuid} suggestions={suggestions} onAdd={(items) => onChange([...exercises, ...items])} />
    </div>
  )
}
