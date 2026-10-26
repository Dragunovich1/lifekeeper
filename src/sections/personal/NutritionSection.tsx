import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  Settings,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type {
  DailyNutritionLog,
  MealEntry,
  MealFoodItem,
  MealType,
} from '../../types'
import { toLocalDateKey } from '../../utils/dates'

const MEAL_TYPES: Array<{ value: MealType; label: string; icon: string }> = [
  { value: 'desayuno', label: 'Desayuno', icon: '🌅' },
  { value: 'almuerzo', label: 'Almuerzo', icon: '☀️' },
  { value: 'merienda', label: 'Merienda', icon: '☕' },
  { value: 'cena', label: 'Cena', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍎' },
  { value: 'suplemento', label: 'Suplementos', icon: '💊' },
]

interface QuickFoodPreset {
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  portion: string
}

const QUICK_FOOD_PRESETS: QuickFoodPreset[] = [
  { name: 'Pechuga de pollo a la plancha', calories: 247, protein: 46, carbs: 0, fats: 5, portion: '150g' },
  { name: 'Arroz blanco cocido', calories: 195, protein: 4, carbs: 43, fats: 0.5, portion: '150g' },
  { name: 'Huevos revueltos (2 u)', calories: 145, protein: 13, carbs: 1, fats: 10, portion: '2 huevos' },
  { name: 'Avena tradicional', calories: 190, protein: 7, carbs: 33, fats: 3.5, portion: '50g' },
  { name: 'Scoop Proteína Whey', calories: 120, protein: 24, carbs: 2, fats: 1.5, portion: '30g' },
  { name: 'Atún al natural', calories: 120, protein: 26, carbs: 0, fats: 1, portion: '1 lata (120g)' },
  { name: 'Yogur griego natural', calories: 100, protein: 15, carbs: 6, fats: 2, portion: '150g' },
  { name: 'Banana / Plátano', calories: 105, protein: 1.3, carbs: 27, fats: 0.3, portion: '1 mediana' },
  { name: 'Frutos secos / Almendras', calories: 175, protein: 6, carbs: 6, fats: 15, portion: '30g' },
  { name: 'Carne vacuna magra', calories: 250, protein: 39, carbs: 0, fats: 9, portion: '150g' },
  { name: 'Fideos / Pasta cocida', calories: 220, protein: 8, carbs: 43, fats: 1.2, portion: '150g' },
  { name: 'Palta / Aguacate', calories: 160, protein: 2, carbs: 9, fats: 15, portion: '100g' },
]

export const NutritionSection = () => {
  const { data, updateData } = useAppData()

  const nutritionData = useMemo(() => {
    return (
      data.personal.nutrition ?? {
        dailyLogs: [],
        dailyGoals: {
          calories: 2000,
          proteinGrams: 140,
          carbsGrams: 220,
          fatsGrams: 60,
        },
      }
    )
  }, [data.personal.nutrition])

  const goals = nutritionData.dailyGoals ?? {
    calories: 2000,
    proteinGrams: 140,
    carbsGrams: 220,
    fatsGrams: 60,
  }

  // Día seleccionado (por defecto hoy)
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()))

  // Modales
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false)
  const [targetMealType, setTargetMealType] = useState<MealType>('almuerzo')
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)
  const [deletingFood, setDeletingFood] = useState<{ mealId: string; foodId: string; name: string } | null>(null)

  // Formulario de nuevo alimento
  const [foodName, setFoodName] = useState('')
  const [foodCalories, setFoodCalories] = useState<number | ''>('')
  const [foodProtein, setFoodProtein] = useState<number | ''>('')
  const [foodCarbs, setFoodCarbs] = useState<number | ''>('')
  const [foodFats, setFoodFats] = useState<number | ''>('')
  const [foodPortion, setFoodPortion] = useState('')

  // Formulario de metas
  const [goalCalories, setGoalCalories] = useState(goals.calories)
  const [goalProtein, setGoalProtein] = useState(goals.proteinGrams)
  const [goalCarbs, setGoalCarbs] = useState(goals.carbsGrams)
  const [goalFats, setGoalFats] = useState(goals.fatsGrams)

  // Registro del día actual seleccionado
  const currentDayLog = useMemo(() => {
    return (nutritionData.dailyLogs ?? []).find((l) => l.date === selectedDate) ?? null
  }, [nutritionData.dailyLogs, selectedDate])

  // Calcular totales del día seleccionado
  const dayTotals = useMemo(() => {
    if (!currentDayLog) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0, totalMeals: 0 }
    }

    let cals = 0
    let prot = 0
    let carb = 0
    let fat = 0
    let count = 0

    currentDayLog.meals.forEach((m) => {
      m.foods.forEach((f) => {
        cals += f.calories || 0
        prot += f.protein || 0
        carb += f.carbs || 0
        fat += f.fats || 0
        count++
      })
    })

    return {
      calories: Math.round(cals),
      protein: Math.round(prot),
      carbs: Math.round(carb),
      fats: Math.round(fat),
      totalMeals: count,
    }
  }, [currentDayLog])

  // Hidratación del mismo día (para correlación)
  const dayHydration = useMemo(() => {
    return (data.health.hydrationLogs ?? []).find((l) => l.date === selectedDate)?.amountMl ?? 0
  }, [data.health.hydrationLogs, selectedDate])

  // Entrenamientos del mismo día
  const dayWorkouts = useMemo(() => {
    return (data.personal.workouts ?? []).filter((w) => w.date.startsWith(selectedDate))
  }, [data.personal.workouts, selectedDate])

  const openAddFoodForMeal = (type: MealType) => {
    setTargetMealType(type)
    setFoodName('')
    setFoodCalories('')
    setFoodProtein('')
    setFoodCarbs('')
    setFoodFats('')
    setFoodPortion('')
    setIsAddFoodOpen(true)
  }

  const applyPreset = (preset: QuickFoodPreset) => {
    setFoodName(preset.name)
    setFoodCalories(preset.calories)
    setFoodProtein(preset.protein)
    setFoodCarbs(preset.carbs)
    setFoodFats(preset.fats)
    setFoodPortion(preset.portion)
  }

  const handleSaveFood = (e: FormEvent) => {
    e.preventDefault()
    if (!foodName.trim()) return

    const newFood: MealFoodItem = {
      id: uuid(),
      name: foodName.trim(),
      calories: Number(foodCalories) || 0,
      protein: foodProtein !== '' ? Number(foodProtein) : undefined,
      carbs: foodCarbs !== '' ? Number(foodCarbs) : undefined,
      fats: foodFats !== '' ? Number(foodFats) : undefined,
      portion: foodPortion.trim() || undefined,
    }

    updateData((previous) => {
      const prevNutrition = previous.personal.nutrition ?? {
        dailyLogs: [],
        dailyGoals: goals,
      }
      const existingLogs = prevNutrition.dailyLogs ?? []
      const currentLog = existingLogs.find((l) => l.date === selectedDate)

      if (currentLog) {
        // Encontrar o crear la comida correspondiente
        const existingMealIndex = currentLog.meals.findIndex((m) => m.type === targetMealType)
        let updatedMeals: MealEntry[]

        if (existingMealIndex >= 0) {
          updatedMeals = currentLog.meals.map((m, idx) =>
            idx === existingMealIndex
              ? { ...m, foods: [...m.foods, newFood] }
              : m,
          )
        } else {
          const newMeal: MealEntry = {
            id: uuid(),
            type: targetMealType,
            foods: [newFood],
          }
          updatedMeals = [...currentLog.meals, newMeal]
        }

        const updatedLogs = existingLogs.map((l) =>
          l.date === selectedDate ? { ...l, meals: updatedMeals } : l,
        )

        return {
          ...previous,
          personal: {
            ...previous.personal,
            nutrition: {
              ...prevNutrition,
              dailyLogs: updatedLogs,
            },
          },
        }
      } else {
        // Crear log para el día
        const newLog: DailyNutritionLog = {
          id: uuid(),
          date: selectedDate,
          meals: [
            {
              id: uuid(),
              type: targetMealType,
              foods: [newFood],
            },
          ],
        }

        return {
          ...previous,
          personal: {
            ...previous.personal,
            nutrition: {
              ...prevNutrition,
              dailyLogs: [newLog, ...existingLogs],
            },
          },
        }
      }
    })

    setIsAddFoodOpen(false)
  }

  const handleDeleteFood = (mealId: string, foodId: string) => {
    updateData((previous) => {
      const prevNutrition = previous.personal.nutrition
      if (!prevNutrition) return previous

      const updatedLogs = (prevNutrition.dailyLogs ?? []).map((log) => {
        if (log.date !== selectedDate) return log

        const updatedMeals = log.meals
          .map((m) => {
            if (m.id !== mealId) return m
            return {
              ...m,
              foods: m.foods.filter((f) => f.id !== foodId),
            }
          })
          .filter((m) => m.foods.length > 0) // Limpiar comidas vacías

        return { ...log, meals: updatedMeals }
      })

      return {
        ...previous,
        personal: {
          ...previous.personal,
          nutrition: {
            ...prevNutrition,
            dailyLogs: updatedLogs,
          },
        },
      }
    })
    setDeletingFood(null)
  }

  const handleSaveGoals = (e: FormEvent) => {
    e.preventDefault()
    updateData((previous) => {
      const prevNutrition = previous.personal.nutrition ?? {
        dailyLogs: [],
        dailyGoals: goals,
      }
      return {
        ...previous,
        personal: {
          ...previous.personal,
          nutrition: {
            ...prevNutrition,
            dailyGoals: {
              calories: Number(goalCalories) || 2000,
              proteinGrams: Number(goalProtein) || 140,
              carbsGrams: Number(goalCarbs) || 220,
              fatsGrams: Number(goalFats) || 60,
            },
          },
        },
      }
    })
    setIsGoalsModalOpen(false)
  }

  // Navegación de días
  const shiftDay = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(toLocalDateKey(d))
  }

  const isToday = selectedDate === toLocalDateKey(new Date())

  // Porcentajes de macros
  const calPercent = Math.min(100, Math.round((dayTotals.calories / (goals.calories || 2000)) * 100))
  const protPercent = Math.min(100, Math.round((dayTotals.protein / (goals.proteinGrams || 140)) * 100))
  const carbPercent = Math.min(100, Math.round((dayTotals.carbs / (goals.carbsGrams || 220)) * 100))
  const fatPercent = Math.min(100, Math.round((dayTotals.fats / (goals.fatsGrams || 60)) * 100))

  return (
    <div>
      <SectionHeader
        title="Nutrición & Plan Alimentario"
        subtitle="Registrá tus comidas, calorías y macronutrientes en sincronía con tu entrenamiento y peso corporal"
      />

      <div className="section-body">
        {/* Barra superior de fecha y controles */}
        <div
          className="subpanel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => shiftDay(-1)}
              aria-label="Día anterior"
              style={{ padding: '0.35rem 0.6rem' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ minWidth: '150px' }}>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                ariaLabel="Seleccionar fecha"
              />
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => shiftDay(1)}
              aria-label="Día siguiente"
              style={{ padding: '0.35rem 0.6rem' }}
            >
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedDate(toLocalDateKey(new Date()))}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              >
                Volver a Hoy
              </button>
            )}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsGoalsModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}
          >
            <Settings size={15} />
            Objetivos y Macros
          </button>
        </div>

        {/* Dashboard de Calorías y Macronutrientes */}
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          {/* Calorías totales */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-title">Calorías consumidas</span>
              <Flame size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className="stat-value">{dayTotals.calories.toLocaleString('es-AR')}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                / {goals.calories.toLocaleString('es-AR')} kcal
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${calPercent}%`,
                  background: calPercent > 105 ? '#ef4444' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span className="panel-subtitle" style={{ marginTop: '0.35rem', display: 'block' }}>
              {goals.calories - dayTotals.calories > 0
                ? `Restan ${goals.calories - dayTotals.calories} kcal para la meta`
                : `Meta completada (+${dayTotals.calories - goals.calories} kcal)`}
            </span>
          </div>

          {/* Proteínas */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-title">Proteínas</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>{protPercent}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className="stat-value" style={{ color: '#38bdf8' }}>{dayTotals.protein}g</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>/ {goals.proteinGrams}g</span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${protPercent}%`, background: '#38bdf8', transition: 'width 0.3s ease' }} />
            </div>
            <span className="panel-subtitle" style={{ marginTop: '0.35rem', display: 'block' }}>
              Reparación muscular y saciedad
            </span>
          </div>

          {/* Carbohidratos */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-title">Carbohidratos</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24' }}>{carbPercent}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className="stat-value" style={{ color: '#fbbf24' }}>{dayTotals.carbs}g</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>/ {goals.carbsGrams}g</span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${carbPercent}%`, background: '#fbbf24', transition: 'width 0.3s ease' }} />
            </div>
            <span className="panel-subtitle" style={{ marginTop: '0.35rem', display: 'block' }}>
              Energía para entrenar y rendir
            </span>
          </div>

          {/* Grasas saludables */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-title">Grasas</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>{fatPercent}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className="stat-value" style={{ color: '#34d399' }}>{dayTotals.fats}g</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>/ {goals.fatsGrams}g</span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fatPercent}%`, background: '#34d399', transition: 'width 0.3s ease' }} />
            </div>
            <span className="panel-subtitle" style={{ marginTop: '0.35rem', display: 'block' }}>
              Salud hormonal y celular
            </span>
          </div>
        </div>

        {/* Notificación de correlación con Agua y Entrenamientos */}
        {(dayHydration > 0 || dayWorkouts.length > 0) && (
          <div
            className="subpanel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
              {dayHydration > 0 && (
                <span>💧 Agua hoy: <strong>{dayHydration} ml</strong></span>
              )}
              {dayWorkouts.length > 0 && (
                <span>
                  🏋️ Sesiones físicas de hoy: <strong>{dayWorkouts.map((w) => w.title).join(', ')}</strong>
                </span>
              )}
            </div>
            <a href="#health:hydration" className="secondary-button" style={{ fontSize: '0.75rem' }}>
              Ver hidratación ↗
            </a>
          </div>
        )}

        {/* Listado de Comidas del Día */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {MEAL_TYPES.map((mealTypeObj) => {
            const currentMeal = currentDayLog?.meals.find((m) => m.type === mealTypeObj.value)
            const foods = currentMeal?.foods ?? []
            const mealCalories = foods.reduce((s, f) => s + (f.calories || 0), 0)
            const mealProtein = foods.reduce((s, f) => s + (f.protein || 0), 0)

            return (
              <div key={mealTypeObj.value} className="panel" style={{ padding: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: foods.length > 0 ? '0.75rem' : 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{mealTypeObj.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                      {mealTypeObj.label}
                    </h3>
                    {foods.length > 0 && (
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                        {mealCalories} kcal · {mealProtein}g P
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openAddFoodForMeal(mealTypeObj.value)}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  >
                    <Plus size={14} />
                    Agregar alimento
                  </button>
                </div>

                {foods.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {foods.map((food) => (
                      <div
                        key={food.id}
                        className="subpanel"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>{food.name}</strong>
                            {food.portion && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                ({food.portion})
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{food.calories} kcal</span>
                            {food.protein !== undefined && <span>P: {food.protein}g</span>}
                            {food.carbs !== undefined && <span>C: {food.carbs}g</span>}
                            {food.fats !== undefined && <span>G: {food.fats}g</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() =>
                            setDeletingFood({
                              mealId: currentMeal!.id,
                              foodId: food.id,
                              name: food.name,
                            })
                          }
                          title="Eliminar alimento"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Sin alimentos registrados en esta comida.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal para Agregar Alimento */}
      <Modal
        open={isAddFoodOpen}
        onClose={() => setIsAddFoodOpen(false)}
        title={`Añadir alimento a ${MEAL_TYPES.find((m) => m.value === targetMealType)?.label || 'Comida'}`}
        subtitle="Ingresá los datos o seleccioná uno de los alimentos frecuentes"
        maxWidth="540px"
      >
        {/* Chips de sugerencias frecuentes */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            Atajos de alimentos comunes:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '110px', overflowY: 'auto' }}>
            {QUICK_FOOD_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="tag-suggestion-chip"
                onClick={() => applyPreset(preset)}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                + {preset.name} ({preset.portion})
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSaveFood} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field-full">
            <label htmlFor="food-name">Nombre del alimento / comida</label>
            <input
              id="food-name"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="Ej. Pechuga de pollo, Taza de avena, Manzana..."
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="food-portion">Porción / Cantidad (opcional)</label>
            <input
              id="food-portion"
              value={foodPortion}
              onChange={(e) => setFoodPortion(e.target.value)}
              placeholder="Ej. 150g, 1 plato, 1 unidad"
            />
          </div>

          <div className="field">
            <label htmlFor="food-cals">Calorías (kcal)</label>
            <input
              id="food-cals"
              type="number"
              min="0"
              value={foodCalories}
              onChange={(e) => setFoodCalories(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 250"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="food-protein">Proteínas (g)</label>
            <input
              id="food-protein"
              type="number"
              step="0.1"
              min="0"
              value={foodProtein}
              onChange={(e) => setFoodProtein(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 30"
            />
          </div>

          <div className="field">
            <label htmlFor="food-carbs">Carbohidratos (g)</label>
            <input
              id="food-carbs"
              type="number"
              step="0.1"
              min="0"
              value={foodCarbs}
              onChange={(e) => setFoodCarbs(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 40"
            />
          </div>

          <div className="field">
            <label htmlFor="food-fats">Grasas (g)</label>
            <input
              id="food-fats"
              type="number"
              step="0.1"
              min="0"
              value={foodFats}
              onChange={(e) => setFoodFats(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 8"
            />
          </div>

          <div className="form-actions field-full" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-button" onClick={() => setIsAddFoodOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar alimento
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal para Calibrar Objetivos Diarios */}
      <Modal
        open={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
        title="Objetivos Nutricionales Diarios"
        subtitle="Configurá tus metas de calorías y macros según tus metas de rendimiento"
        maxWidth="480px"
      >
        <form onSubmit={handleSaveGoals} className="form-grid two-columns">
          <div className="field-full">
            <label htmlFor="goal-cals">Calorías diarias objetivo (kcal)</label>
            <input
              id="goal-cals"
              type="number"
              min="800"
              max="6000"
              value={goalCalories}
              onChange={(e) => setGoalCalories(Number(e.target.value) || 2000)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="goal-prot">Proteínas diarias (g)</label>
            <input
              id="goal-prot"
              type="number"
              min="20"
              max="400"
              value={goalProtein}
              onChange={(e) => setGoalProtein(Number(e.target.value) || 140)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="goal-carbs">Carbohidratos diarios (g)</label>
            <input
              id="goal-carbs"
              type="number"
              min="20"
              max="800"
              value={goalCarbs}
              onChange={(e) => setGoalCarbs(Number(e.target.value) || 220)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="goal-fats">Grasas diarias (g)</label>
            <input
              id="goal-fats"
              type="number"
              min="10"
              max="250"
              value={goalFats}
              onChange={(e) => setGoalFats(Number(e.target.value) || 60)}
              required
            />
          </div>

          <div className="form-actions field-full" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-button" onClick={() => setIsGoalsModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar objetivos
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmación para eliminar alimento */}
      <ConfirmModal
        open={Boolean(deletingFood)}
        title="Eliminar alimento"
        message={deletingFood ? `¿Querés eliminar "${deletingFood.name}" de este registro?` : ''}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingFood) handleDeleteFood(deletingFood.mealId, deletingFood.foodId)
        }}
        onClose={() => setDeletingFood(null)}
      />
    </div>
  )
}
