import { useMemo } from 'react'
import { useMatches } from 'react-router-dom'

/**
 * Returns the headings of the current page, extracted from the route loader data.
 * Useful for building custom Tables of Contents or jumping to sections.
 *
 * @returns An array of heading objects with level, text, and id.
 */
export function useHeadings(): { level: number; text: string; id: string }[] {
  const matches = useMatches()
  return useMemo(() => {
    const last = matches[matches.length - 1]
    const data = last?.data as Record<string, unknown>
    return (data?.headings as { level: number; text: string; id: string }[]) || []
  }, [matches])
}
