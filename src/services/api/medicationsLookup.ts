/**
 * Servicio de búsqueda y autocompletado de medicamentos.
 * Consulta la API de RxNorm (National Library of Medicine) y OpenFDA con fallback local offline.
 */

export interface MedicationSuggestion {
  name: string
  substance?: string
  commonDosages?: string[]
  category?: string
}

const COMMON_FALLBACK_MEDS: MedicationSuggestion[] = [
  { name: 'Ibuprofeno', substance: 'Ibuprofeno', commonDosages: ['400 mg', '600 mg'], category: 'Analgésico / Antiinflamatorio' },
  { name: 'Paracetamol', substance: 'Paracetamol', commonDosages: ['500 mg', '1 g'], category: 'Analgésico / Antipirético' },
  { name: 'Amoxicilina', substance: 'Amoxicilina', commonDosages: ['500 mg', '875 mg'], category: 'Antibiótico' },
  { name: 'Losartán', substance: 'Losartán potásico', commonDosages: ['50 mg', '100 mg'], category: 'Antihipertensivo' },
  { name: 'Omeprazol', substance: 'Omeprazol', commonDosages: ['20 mg', '40 mg'], category: 'Protector gástrico' },
  { name: 'Metformina', substance: 'Metformina', commonDosages: ['500 mg', '850 mg', '1000 mg'], category: 'Antidiabético' },
  { name: 'Levotiroxina', substance: 'Levotiroxina sódica', commonDosages: ['50 mcg', '75 mcg', '100 mcg'], category: 'Tiroideo' },
  { name: 'Atorvastatina', substance: 'Atorvastatina', commonDosages: ['10 mg', '20 mg', '40 mg'], category: 'Hipolipemiante' },
  { name: 'Clonazepam', substance: 'Clonazepam', commonDosages: ['0.5 mg', '1 mg', '2 mg'], category: 'Ansiolítico' },
  { name: 'Sertralina', substance: 'Sertralina', commonDosages: ['50 mg', '100 mg'], category: 'Antidepresivo' },
  { name: 'Enalapril', substance: 'Enalapril', commonDosages: ['5 mg', '10 mg', '20 mg'], category: 'Antihipertensivo' },
  { name: 'Loratadina', substance: 'Loratadina', commonDosages: ['10 mg'], category: 'Antihistamínico' },
  { name: 'Cetirizina', substance: 'Cetirizina', commonDosages: ['10 mg'], category: 'Antihistamínico' },
  { name: 'Aspirina (Ácido Acetilsalicílico)', substance: 'Ácido Acetilsalicílico', commonDosages: ['100 mg', '500 mg'], category: 'Antiagregante / Analgésico' },
  { name: 'Dipirona (Metamizol)', substance: 'Metamizol', commonDosages: ['500 mg', '1 g'], category: 'Analgésico / Antipirético' },
  { name: 'Diclofenac', substance: 'Diclofenac sódico', commonDosages: ['50 mg', '75 mg'], category: 'Antiinflamatorio' },
  { name: 'Salbutamol', substance: 'Salbutamol', commonDosages: ['100 mcg / inhalación'], category: 'Broncodilatador' },
]

export async function searchMedications(query: string): Promise<MedicationSuggestion[]> {
  const cleanQuery = query.trim().toLowerCase()
  if (!cleanQuery || cleanQuery.length < 2) return []

  // Primero filtramos la base local para respuesta instantánea
  const localMatches = COMMON_FALLBACK_MEDS.filter(
    (m) =>
      m.name.toLowerCase().includes(cleanQuery) ||
      (m.substance && m.substance.toLowerCase().includes(cleanQuery)),
  )

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    // Búsqueda rápida vía RxNorm
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(cleanQuery)}`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    if (res.ok) {
      const data = (await res.json()) as {
        drugGroup?: {
          conceptGroup?: Array<{
            conceptProperties?: Array<{
              name: string
              synonym?: string
            }>
          }>
        }
      }

      const externalResults: MedicationSuggestion[] = []
      const groups = data.drugGroup?.conceptGroup ?? []
      for (const group of groups) {
        for (const prop of group.conceptProperties ?? []) {
          if (prop.name && !externalResults.some((e) => e.name.toLowerCase() === prop.name.toLowerCase())) {
            externalResults.push({
              name: prop.name,
              category: 'Registro farmacéutico NLM RxNorm',
            })
            if (externalResults.length >= 8) break
          }
        }
        if (externalResults.length >= 8) break
      }

      // Combinar priorizando coincidencias locales
      const namesSeen = new Set<string>()
      const combined: MedicationSuggestion[] = []

      for (const item of [...localMatches, ...externalResults]) {
        const key = item.name.toLowerCase()
        if (!namesSeen.has(key)) {
          namesSeen.add(key)
          combined.push(item)
        }
      }

      return combined.slice(0, 8)
    }
  } catch {
    // Si falla o timeout, devolver los locales
  }

  return localMatches.slice(0, 8)
}
