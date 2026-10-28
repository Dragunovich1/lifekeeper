import { useMemo, useRef, useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { Check, Copy, Minus, Plus, RotateCcw, Share2, ShoppingCart, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { FinanceTransaction, ShoppingData, ShoppingItem, ShoppingList } from '../../types'
import { formatMoney } from '../../utils/calculator'
import { toLocalDateKey } from '../../utils/dates'
import {
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
  guessCategory,
  lineTotal,
  listToText,
  normalizeProductKey,
  sumItems,
} from '../../utils/shopping'
import '../../styles/utility-tools.css'

const EMPTY_SHOPPING: ShoppingData = { lists: [], activeListId: undefined, priceMemory: {} }

const stepFor = (unit?: string) => (unit === 'kg' || unit === 'l' ? 0.5 : unit === 'g' || unit === 'ml' ? 100 : 1)

export const ShoppingListSection = () => {
  const { data, updateData } = useAppData()
  const shopping = data.personal.shopping ?? EMPTY_SHOPPING
  const lists = shopping.lists
  const activeList = lists.find((l) => l.id === shopping.activeListId) ?? lists[0] ?? null

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<string>('u')
  const [price, setPrice] = useState('')
  const [newListName, setNewListName] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishTotal, setFinishTotal] = useState('')
  const [registerExpense, setRegisterExpense] = useState(true)
  const [deleteListOpen, setDeleteListOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const patchShopping = (fn: (s: ShoppingData) => ShoppingData) =>
    updateData((prev) => ({
      ...prev,
      personal: { ...prev.personal, shopping: fn(prev.personal.shopping ?? EMPTY_SHOPPING) },
    }))

  const patchList = (listId: string, fn: (l: ShoppingList) => ShoppingList, memory?: Record<string, { price: number; date: string }>) =>
    patchShopping((s) => ({
      ...s,
      lists: s.lists.map((l) => (l.id === listId ? fn(l) : l)),
      priceMemory: memory ? { ...s.priceMemory, ...memory } : s.priceMemory,
    }))

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2200)
  }

  // ---- Listas -------------------------------------------------------------
  const createList = (event: FormEvent) => {
    event.preventDefault()
    const listName = newListName.trim()
    if (!listName) return
    const list: ShoppingList = { id: uuid(), name: listName, items: [], currency: 'ARS', createdAt: new Date().toISOString() }
    patchShopping((s) => ({ ...s, lists: [...s.lists, list], activeListId: list.id }))
    setNewListName('')
    setShowNewList(false)
  }

  const ensureList = (): ShoppingList => {
    if (activeList) return activeList
    const list: ShoppingList = { id: uuid(), name: 'Compras', items: [], currency: 'ARS', createdAt: new Date().toISOString() }
    patchShopping((s) => ({ ...s, lists: [...s.lists, list], activeListId: list.id }))
    return list
  }

  const deleteActiveList = () => {
    if (!activeList) return
    patchShopping((s) => {
      const rest = s.lists.filter((l) => l.id !== activeList.id)
      return { ...s, lists: rest, activeListId: rest[0]?.id }
    })
    setDeleteListOpen(false)
  }

  // ---- Productos ----------------------------------------------------------
  const rememberedPrice = useMemo(() => {
    const key = normalizeProductKey(name)
    return key ? shopping.priceMemory[key] : undefined
  }, [name, shopping.priceMemory])

  const suggestions = useMemo(() => {
    const names = new Set<string>()
    Object.keys(shopping.priceMemory).forEach((k) => names.add(k))
    lists.forEach((l) => l.items.forEach((i) => names.add(normalizeProductKey(i.name))))
    return [...names].slice(0, 80)
  }, [lists, shopping.priceMemory])

  const addItem = (event: FormEvent) => {
    event.preventDefault()
    const itemName = name.trim()
    if (!itemName) return
    const list = ensureList()
    const qty = Math.max(parseFloat(quantity.replace(',', '.')) || 1, 0.01)
    const typedPrice = parseFloat(price.replace(',', '.'))
    const key = normalizeProductKey(itemName)
    const finalPrice = Number.isFinite(typedPrice) && typedPrice > 0 ? typedPrice : shopping.priceMemory[key]?.price

    const item: ShoppingItem = {
      id: uuid(),
      name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      quantity: qty,
      unit: unit === 'u' ? undefined : unit,
      price: finalPrice,
      category: guessCategory(itemName),
      checked: false,
      addedAt: new Date().toISOString(),
    }
    patchList(
      list.id,
      (l) => ({ ...l, items: [item, ...l.items] }),
      finalPrice && Number.isFinite(typedPrice) ? { [key]: { price: finalPrice, date: toLocalDateKey(new Date()) } } : undefined,
    )
    setName('')
    setQuantity('1')
    setUnit('u')
    setPrice('')
    nameRef.current?.focus()
  }

  const updateItem = (item: ShoppingItem, changes: Partial<ShoppingItem>) => {
    if (!activeList) return
    const memory =
      changes.price && changes.price > 0 ? { [normalizeProductKey(item.name)]: { price: changes.price, date: toLocalDateKey(new Date()) } } : undefined
    patchList(activeList.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === item.id ? { ...i, ...changes } : i)) }), memory)
  }

  const toggleItem = (item: ShoppingItem) =>
    updateItem(item, { checked: !item.checked, checkedAt: !item.checked ? new Date().toISOString() : undefined })

  const removeItem = (item: ShoppingItem) => {
    if (!activeList) return
    patchList(activeList.id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== item.id) }))
  }

  const uncheckAll = () => {
    if (!activeList) return
    patchList(activeList.id, (l) => ({ ...l, items: l.items.map((i) => ({ ...i, checked: false, checkedAt: undefined })) }))
  }

  // ---- Totales ------------------------------------------------------------
  const items = activeList?.items ?? []
  const pending = items.filter((i) => !i.checked)
  const inCart = items.filter((i) => i.checked)
  const estimated = sumItems(items)
  const cartTotal = sumItems(inCart)
  const budget = activeList?.budget
  const progress = items.length ? Math.round((inCart.length / items.length) * 100) : 0
  const currency = activeList?.currency ?? 'ARS'
  const overBudget = Boolean(budget && estimated > budget)

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const item of pending) map.set(item.category, [...(map.get(item.category) ?? []), item])
    return SHOPPING_CATEGORIES.filter((c) => map.has(c)).map((c) => ({ category: c as string, items: map.get(c)! }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList?.items])

  // ---- Finalizar compra -----------------------------------------------------
  const openFinish = () => {
    setFinishTotal(cartTotal ? String(Math.round(cartTotal * 100) / 100) : '')
    setRegisterExpense(true)
    setFinishOpen(true)
  }

  const finishShopping = (event: FormEvent) => {
    event.preventDefault()
    if (!activeList) return
    const total = parseFloat(finishTotal.replace(',', '.'))
    const today = toLocalDateKey(new Date())
    const expense: FinanceTransaction | null =
      registerExpense && Number.isFinite(total) && total > 0
        ? { id: uuid(), type: 'expense', amount: total, currency: activeList.currency, category: 'Alimentación', description: `Compras: ${activeList.name}`, date: today }
        : null

    updateData((prev) => {
      const s = prev.personal.shopping ?? EMPTY_SHOPPING
      const memory = { ...s.priceMemory }
      for (const i of activeList.items) if (i.checked && i.price) memory[normalizeProductKey(i.name)] = { price: i.price, date: today }
      return {
        ...prev,
        personal: {
          ...prev.personal,
          finances: expense ? [expense, ...prev.personal.finances] : prev.personal.finances,
          shopping: { ...s, priceMemory: memory, lists: s.lists.map((l) => (l.id === activeList.id ? { ...l, items: l.items.filter((i) => !i.checked) } : l)) },
        },
      }
    })
    setFinishOpen(false)
    flash(expense ? 'Compra finalizada y registrada en Finanzas' : 'Compra finalizada')
  }

  // ---- Compartir ------------------------------------------------------------
  const shareList = async () => {
    if (!activeList) return
    const text = listToText(activeList)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: activeList.name, text })
        return
      }
      await navigator.clipboard.writeText(text)
      flash('Lista copiada: pegala en WhatsApp')
    } catch {
      /* el usuario canceló o el portapapeles está bloqueado */
    }
  }

  const copyList = async () => {
    if (!activeList) return
    try {
      await navigator.clipboard.writeText(listToText(activeList))
      flash('Lista copiada al portapapeles')
    } catch {
      flash('No se pudo copiar')
    }
  }

  const renderRow = (item: ShoppingItem) => {
    const open = openRowId === item.id
    return (
      <li key={item.id} className={`shop-row ${item.checked ? 'is-checked' : ''} ${open ? 'is-open' : ''}`}>
        <button
          type="button"
          className="shop-check"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={`${item.checked ? 'Quitar del carrito' : 'Marcar'} ${item.name}`}
          onClick={() => toggleItem(item)}
        >
          {item.checked && <Check size={16} strokeWidth={3} />}
        </button>

        <button type="button" className="shop-row-main" aria-expanded={open} aria-label={`Editar cantidad y precio de ${item.name}`} onClick={() => setOpenRowId(open ? null : item.id)}>
          <span className="shop-row-name">{item.name}</span>
          <span className="shop-row-meta">
            {item.quantity}
            {item.unit ? ` ${item.unit}` : ' u'}
            {item.price ? ` · ${formatMoney(item.price, currency)} c/u` : ' · tocá para poner precio'}
          </span>
        </button>

        <div className="shop-row-edit">
          <div className="shop-qty" aria-label={`Cantidad de ${item.name}`}>
            <button type="button" aria-label="Menos" onClick={() => updateItem(item, { quantity: Math.max(stepFor(item.unit), Math.round((item.quantity - stepFor(item.unit)) * 100) / 100) })}>
              <Minus size={14} />
            </button>
            <span>{item.quantity}</span>
            <button type="button" aria-label="Más" onClick={() => updateItem(item, { quantity: Math.round((item.quantity + stepFor(item.unit)) * 100) / 100 })}>
              <Plus size={14} />
            </button>
          </div>

          <label className="shop-price" aria-label={`Precio unitario de ${item.name}`}>
            <span>$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Precio"
              defaultValue={item.price ?? ''}
              key={`${item.id}-${item.price ?? ''}`}
              onBlur={(e) => {
                const value = parseFloat(e.target.value)
                if ((Number.isFinite(value) ? value : undefined) !== item.price) updateItem(item, { price: Number.isFinite(value) && value > 0 ? value : undefined })
              }}
            />
          </label>
        </div>

        <span className="shop-line-total">{item.price ? formatMoney(lineTotal(item), currency) : ''}</span>

        <button type="button" className="shop-del" aria-label={`Eliminar ${item.name}`} onClick={() => removeItem(item)}>
          <X size={16} />
        </button>
      </li>
    )
  }

  return (
    <div className="tool-page">
      <SectionHeader
        title="Lista de compras"
        subtitle="Armá tu lista, tildá lo que vas poniendo en el carrito y controlá cuánto vas gastando."
        actions={
          activeList ? (
            <>
              <button type="button" className="secondary-button tool-icon-btn" onClick={copyList} aria-label="Copiar lista">
                <Copy size={15} /> <span>Copiar</span>
              </button>
              <button type="button" className="primary-button tool-icon-btn" onClick={shareList} aria-label="Compartir lista">
                <Share2 size={15} /> <span>Compartir</span>
              </button>
            </>
          ) : undefined
        }
      />

      {/* Selector de listas */}
      <div className="shop-lists" role="tablist" aria-label="Listas de compras">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === activeList?.id}
            className={`shop-list-tab ${l.id === activeList?.id ? 'is-active' : ''}`}
            onClick={() => patchShopping((s) => ({ ...s, activeListId: l.id }))}
          >
            {l.name}
            <span>{l.items.filter((i) => !i.checked).length}</span>
          </button>
        ))}
        {showNewList ? (
          <form className="shop-new-list" onSubmit={createList}>
            <input autoFocus value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nombre (ej. Verdulería)" aria-label="Nombre de la nueva lista" />
            <button type="submit" className="primary-button" aria-label="Crear lista"><Check size={15} /></button>
            <button type="button" className="secondary-button" aria-label="Cancelar" onClick={() => setShowNewList(false)}><X size={15} /></button>
          </form>
        ) : (
          <button type="button" className="shop-list-tab is-new" onClick={() => setShowNewList(true)}>
            <Plus size={14} /> Nueva lista
          </button>
        )}
      </div>

      {/* Agregar producto */}
      <form className="card shop-add" onSubmit={addItem}>
        <div className="shop-add-name">
          <ShoppingCart size={18} aria-hidden="true" />
          <input
            ref={nameRef}
            list="shop-suggestions"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agregá un producto… (ej. leche)"
            aria-label="Producto"
            autoComplete="off"
          />
          <datalist id="shop-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button type="button" className={`shop-more ${showDetails ? 'is-active' : ''}`} aria-expanded={showDetails} aria-label="Cantidad, unidad y precio" title="Cantidad, unidad y precio" onClick={() => setShowDetails((v) => !v)}>
            <SlidersHorizontal size={16} />
          </button>
          <button type="submit" className="primary-button shop-add-btn" disabled={!name.trim()} aria-label="Agregar producto">
            <Plus size={16} /> <span>Agregar</span>
          </button>
        </div>
        <div className={`shop-add-fields ${showDetails ? 'is-open' : ''}`}>
          <label>
            <span>Cant.</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            <span>Unidad</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {SHOPPING_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Precio unit. (opcional)</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={rememberedPrice ? String(rememberedPrice.price) : '0'} />
          </label>
        </div>
        {rememberedPrice && !price && (
          <p className="shop-hint">Último precio que cargaste: <strong>{formatMoney(rememberedPrice.price, currency)}</strong> ({rememberedPrice.date.split('-').reverse().join('/')}). Se usa solo si no ponés otro.</p>
        )}
      </form>

      {!activeList || items.length === 0 ? (
        <div className="empty-state shop-empty">
          <ShoppingCart size={34} aria-hidden="true" />
          <h3>{activeList ? 'Tu lista está vacía' : 'Todavía no tenés ninguna lista'}</h3>
          <p>Escribí un producto arriba y apretá Enter. También podés decirle al asistente: <em>“sumá leche y pan a la lista”</em>.</p>
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="card shop-summary">
            <div className="shop-summary-top">
              <div>
                <span className="shop-summary-label">En el carrito</span>
                <strong>{inCart.length} de {items.length}</strong>
              </div>
              <div>
                <span className="shop-summary-label">Total estimado</span>
                <strong>{estimated ? formatMoney(estimated, currency) : '—'}</strong>
              </div>
              <div>
                <span className="shop-summary-label">Ya en el carrito</span>
                <strong>{cartTotal ? formatMoney(cartTotal, currency) : '—'}</strong>
              </div>
              <label className="shop-budget">
                <span className="shop-summary-label">Presupuesto</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Sin límite"
                  defaultValue={budget ?? ''}
                  key={`${activeList.id}-${budget ?? ''}`}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    patchList(activeList.id, (l) => ({ ...l, budget: Number.isFinite(v) && v > 0 ? v : undefined }))
                  }}
                />
              </label>
            </div>
            <div className="shop-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la compra">
              <div style={{ width: `${progress}%` }} />
            </div>
            {budget ? (
              <p className={`shop-budget-note ${overBudget ? 'is-over' : ''}`}>
                {overBudget ? `Te pasás del presupuesto por ${formatMoney(estimated - budget, currency)}` : `Te quedan ${formatMoney(budget - estimated, currency)} del presupuesto`}
              </p>
            ) : null}
          </div>

          {/* Pendientes por categoría */}
          {grouped.map((g) => (
            <section key={g.category} className="shop-group" aria-label={g.category}>
              <h3>{g.category} <span>{g.items.length}</span></h3>
              <ul className="shop-items">{g.items.map(renderRow)}</ul>
            </section>
          ))}

          {/* En el carrito */}
          {inCart.length > 0 && (
            <section className="shop-group shop-cart" aria-label="En el carrito">
              <h3>En el carrito <span>{inCart.length}</span></h3>
              <ul className="shop-items">{inCart.map(renderRow)}</ul>
            </section>
          )}

          <div className="shop-actions">
            <button type="button" className="secondary-button tool-icon-btn" onClick={uncheckAll} disabled={inCart.length === 0} aria-label="Destildar todo">
              <RotateCcw size={15} /> <span>Destildar todo</span>
            </button>
            <button type="button" className="secondary-button danger tool-icon-btn" onClick={() => setDeleteListOpen(true)} aria-label="Borrar lista">
              <Trash2 size={15} /> <span>Borrar lista</span>
            </button>
            <button type="button" className="primary-button shop-finish" onClick={openFinish} disabled={inCart.length === 0}>
              <Check size={16} /> Finalizar compra{inCart.length > 0 && cartTotal > 0 ? ` · ${formatMoney(cartTotal, currency)}` : ''}
            </button>
          </div>
        </>
      )}

      {activeList && items.length === 0 && lists.length > 0 && (
        <div className="shop-actions">
          <button type="button" className="secondary-button danger" onClick={() => setDeleteListOpen(true)}>
            <Trash2 size={15} /> Borrar lista
          </button>
        </div>
      )}

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finalizar compra" subtitle={`${inCart.length} productos en el carrito`}>
        <form className="form-grid" onSubmit={finishShopping}>
          <div className="field field-full">
            <label htmlFor="shop-total">Total pagado ({currency})</label>
            <input id="shop-total" type="number" inputMode="decimal" min="0" step="any" value={finishTotal} onChange={(e) => setFinishTotal(e.target.value)} autoFocus />
          </div>
          <label className="shop-check-row field-full">
            <input type="checkbox" checked={registerExpense} onChange={(e) => setRegisterExpense(e.target.checked)} />
            <span>Registrar como gasto en Finanzas (Alimentación)</span>
          </label>
          <p className="shop-hint field-full">Se sacan de la lista los productos tildados y se recuerdan sus precios para la próxima.</p>
          <button type="submit" className="primary-button field-full">Confirmar</button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteListOpen}
        title="Borrar lista"
        message={`¿Borrar "${activeList?.name ?? ''}" con todos sus productos? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={deleteActiveList}
        onClose={() => setDeleteListOpen(false)}
      />

      {notice && (
        <div className="tool-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}
