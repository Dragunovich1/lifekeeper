import type { KeyboardEvent } from 'react'
import { useState } from 'react'

interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export const TagInput = ({ values, onChange, placeholder }: TagInputProps) => {
  const [buffer, setBuffer] = useState('')

  const commit = (candidate: string) => {
    const trimmed = candidate.trim()
    if (!trimmed) {
      return
    }

    if (!values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setBuffer('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(buffer)
    }
    if (event.key === 'Backspace' && !buffer && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="tag-input">
      {values.map((tag) => (
        <span key={tag} className="chip">
          {tag}
          <button
            type="button"
            className="chip-remove"
            onClick={() => onChange(values.filter((value) => value !== tag))}
          >
            x
          </button>
        </span>
      ))}
      <input
        value={buffer}
        onChange={(event) => setBuffer(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  )
}
