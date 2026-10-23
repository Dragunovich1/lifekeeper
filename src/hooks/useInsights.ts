import { useCallback, useMemo } from 'react'
import { computeSmartSummary, searchVaultRecords } from '../utils/insights'
import { useAppData } from './useAppData'

export const useInsights = () => {
  const { data } = useAppData()

  const summary = useMemo(() => computeSmartSummary(data), [data])

  const search = useCallback(
    (query: string) => searchVaultRecords(data, query),
    [data],
  )

  return {
    ...summary,
    search,
  }
}
