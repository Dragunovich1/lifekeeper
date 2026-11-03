import { useEffect, useMemo, useRef, useState } from 'react'
import { Autocomplete, type AutocompleteOption } from './Autocomplete'
import { matchCountry, matchRegion, norm, regionsFor, searchCountries, searchRegions, type PlaceHit } from '../data/places'
import { searchPlaces } from '../services/api/geocode'

export interface LocationValue {
  country: string
  countryCode?: string
  province: string
  city: string
  latitude?: number
  longitude?: number
}

interface Props {
  value: LocationValue
  onChange: (next: LocationValue) => void
  idPrefix?: string
}

/**
 * País → Provincia/estado → Ciudad con sugerencias mientras se escribe.
 *  - País y provincias/estados funcionan sin internet.
 *  - Las ciudades vienen del servidor (con respaldo local). Al elegir una ciudad se completan la provincia y el país.
 */
export function LocationFields({ value, onChange, idPrefix = 'loc' }: Props) {
  const [cityOptions, setCityOptions] = useState<AutocompleteOption<PlaceHit>[]>([])
  const [loadingCity, setLoadingCity] = useState(false)
  const [knownAdmins, setKnownAdmins] = useState<string[]>([])
  const skipSearch = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const set = (patch: Partial<LocationValue>) => onChange({ ...valueRef.current, ...patch })

  // ----- País
  const countryOptions = useMemo<AutocompleteOption[]>(
    () => searchCountries(value.country).map((c) => ({ value: c.name, hint: c.code, data: c })),
    [value.country],
  )

  const pickCountry = (name: string, code?: string) => {
    const changed = (code ?? '') !== (valueRef.current.countryCode ?? '')
    // Al cambiar de país, la provincia y la ciudad anteriores dejan de valer
    set(changed ? { country: name, countryCode: code, province: '', city: '', latitude: undefined, longitude: undefined } : { country: name, countryCode: code })
    setKnownAdmins([])
  }

  // ----- Provincia / estado
  const regionList = regionsFor(value.countryCode)
  const provinceOptions = useMemo<AutocompleteOption[]>(() => {
    if (regionList.length) return searchRegions(value.countryCode, value.province).map((r) => ({ value: r }))
    const q = norm(value.province)
    return knownAdmins.filter((a) => !q || norm(a).includes(q)).slice(0, 8).map((a) => ({ value: a }))
  }, [regionList.length, value.countryCode, value.province, knownAdmins])

  // ----- Ciudad (con espera para no consultar en cada tecla)
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false
      return
    }
    const text = value.city.trim()
    if (text.length < 2) {
      setCityOptions([])
      setLoadingCity(false)
      return
    }
    const controller = new AbortController()
    setLoadingCity(true)
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchPlaces(text, { countryCode: value.countryCode, admin1: value.province || undefined, signal: controller.signal })
        if (controller.signal.aborted) return
        setCityOptions(
          hits.map((p) => ({ value: p.name, hint: [p.admin1, p.country].filter(Boolean).join(', '), data: p })),
        )
        const admins = [...new Set(hits.map((h) => h.admin1).filter((a): a is string => Boolean(a)))]
        if (admins.length) setKnownAdmins((prev) => [...new Set([...prev, ...admins])])
      } catch {
        /* cancelado por otra búsqueda más nueva */
      } finally {
        if (!controller.signal.aborted) setLoadingCity(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value.city, value.countryCode, value.province])

  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-country`}>País</label>
        <Autocomplete
          id={`${idPrefix}-country`}
          value={value.country}
          showOnEmpty
          placeholder="Empezá a escribir… (ej. Argentina)"
          options={countryOptions}
          emptyText="No hay un país con ese nombre. Revisá cómo lo escribiste."
          onChange={(text) => {
            const match = matchCountry(text)
            // Mientras se escribe solo se actualiza el texto; el país queda "elegido" al tocar una sugerencia o al coincidir exacto
            set({ country: text, countryCode: match?.code })
          }}
          onPick={(o) => pickCountry(o.value, (o.data as { code: string }).code)}
          onBlurValue={(text) => {
            const match = matchCountry(text)
            if (match) pickCountry(match.name, match.code)
          }}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-province`}>Provincia / estado</label>
        <Autocomplete
          id={`${idPrefix}-province`}
          value={value.province}
          showOnEmpty={regionList.length > 0}
          placeholder={regionList.length ? 'Empezá a escribir… (ej. Córdoba)' : 'Provincia, estado o región'}
          options={provinceOptions}
          onChange={(text) => set({ province: text })}
          onPick={(o) => set({ province: o.value })}
          onBlurValue={(text) => {
            const canonical = matchRegion(valueRef.current.countryCode, text)
            if (canonical && canonical !== text) set({ province: canonical })
          }}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-city`}>Ciudad o localidad</label>
        <Autocomplete<PlaceHit>
          id={`${idPrefix}-city`}
          value={value.city}
          loading={loadingCity}
          placeholder="Empezá a escribir… (ej. Quilmes)"
          options={cityOptions}
          emptyText="No encontramos esa ciudad: podés dejar lo que escribiste."
          onChange={(text) => set({ city: text, latitude: undefined, longitude: undefined })}
          onPick={(o) => {
            const p = o.data
            if (!p) return set({ city: o.value })
            skipSearch.current = true
            onChange({
              city: p.name,
              province: p.admin1 ?? valueRef.current.province,
              country: p.country || valueRef.current.country,
              countryCode: p.countryCode || valueRef.current.countryCode,
              latitude: p.latitude,
              longitude: p.longitude,
            })
          }}
        />
        <span className="pref-help" style={{ marginTop: 2 }}>
          Elegí una ciudad de la lista y se completan solos la provincia y el país.
        </span>
      </div>
    </>
  )
}
