import { distance } from 'fastest-levenshtein'

/**
 * Smart string similarity helper that considers path structure.
 */
export function getSimilarity(link: string, target: string): number {
  if (link === target) return 1
  if (!link || !target) return 0

  const linkSegments = link.split('/').filter(Boolean)
  const targetSegments = target.split('/').filter(Boolean)
  const linkName = linkSegments[linkSegments.length - 1] || ''
  const targetName = targetSegments[targetSegments.length - 1] || ''

  // 1. Path-Aware Check: If filenames match exactly
  if (linkName === targetName) {
    let overlap = 0
    for (const seg of linkSegments) {
      if (targetSegments.includes(seg)) overlap++
    }
    if (overlap >= 2) return 0.99
    return 0.90
  }

  // 2. Prefix Check: If one filename starts with the other
  if (linkName.length > 3 && targetName.length > 3) {
    if (targetName.startsWith(linkName) || linkName.startsWith(targetName)) {
      const ratio = Math.min(linkName.length, targetName.length) / Math.max(linkName.length, targetName.length)
      if (ratio > 0.5) return 0.88
    }
  }

  // 3. Fuzzy match filenames
  const nameSim = 1 - distance(linkName, targetName) / Math.max(linkName.length, targetName.length)
  if (nameSim > 0.8) {
    return nameSim * 0.95
  }

  // 4. Fallback to full path Levenshtein
  const dist = distance(link, target)
  return 1 - dist / Math.max(link.length, target.length)
}

const similarityCache = new Map<string, { bestMatch: string; similarity: number }>()

export function getCachedSimilarity(link: string, routes: string[]): { bestMatch: string; similarity: number } {
  if (similarityCache.has(link)) return similarityCache.get(link)!
  
  let bestMatch = ''
  let maxSim = 0
  for (const route of routes) {
    if (route === link) continue
    const sim = getSimilarity(link, route)
    if (sim > maxSim) { maxSim = sim; bestMatch = route }
  }
  
  const result = { bestMatch, similarity: maxSim }
  similarityCache.set(link, result)
  return result
}
