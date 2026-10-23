import { useMemo, useRef, useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  tags?: string[]
  values?: string[]
  onTagsChange?: (tags: string[]) => void
  onChange?: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  ariaLabel?: string
}

export const TagInput = ({
  tags,
  values,
  onTagsChange,
  onChange,
  placeholder = 'Añadir etiqueta y presionar Enter...',
  suggestions = [],
  ariaLabel = 'Etiquetas',
}: TagInputProps) => {
  const tagList = tags || values || []
  const handleChange = onTagsChange || onChange || (() => {})
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (rawTag: string) => {
    const cleaned = rawTag.trim()
    if (!cleaned) return
    const exists = tagList.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())
    if (!exists) {
      handleChange([...tagList, cleaned])
    }
  }

  const removeTag = (tagToRemove: string) => {
    handleChange(tagList.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
        setInputValue('')
      }
    } else if (e.key === 'Backspace' && !inputValue && tagList.length > 0) {
      removeTag(tagList[tagList.length - 1])
    }
  }

  const availableSuggestions = useMemo(() => {
    const lowerSelected = new Set(tagList.map((t) => t.toLowerCase()))
    const query = inputValue.trim().toLowerCase()
    const unique: string[] = []
    const seen = new Set<string>()
    for (const s of suggestions) {
      const cleaned = s.trim()
      if (!cleaned) continue
      const key = cleaned.toLowerCase()
      if (lowerSelected.has(key) || seen.has(key)) continue
      if (query && !key.includes(query)) continue
      seen.add(key)
      unique.push(cleaned)
      if (unique.length >= 8) break
    }
    return unique
  }, [suggestions, tagList, inputValue])

  return (
    <div className="tag-input-wrapper">
      <div className="tag-input" onClick={() => inputRef.current?.focus()}>
        {tagList.map((tag) => (
          <div key={tag} className="tag">
            {tag}
            <button
              type="button"
              className="tag-remove"
              onClick={(event) => {
                event.stopPropagation()
                removeTag(tag)
              }}
              aria-label={`Quitar etiqueta ${tag}`}
            >
              &times;
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) {
              addTag(inputValue)
              setInputValue('')
            }
          }}
          className="tag-input-field"
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      </div>
      {availableSuggestions.length > 0 ? (
        <div className="tag-suggestions" aria-label="Etiquetas sugeridas">
          <span className="tag-suggestions-label">Sugeridas:</span>
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="tag-suggestion-chip"
              onClick={() => {
                addTag(suggestion)
                setInputValue('')
              }}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
