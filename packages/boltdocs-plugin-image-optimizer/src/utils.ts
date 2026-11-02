import fs from 'node:fs'
import { join } from 'node:path'
import { colors, error as duiError, success, table, info } from '@bdocs/dui'

interface Sizes {
  size: number
  oldSize: number
  ratio: number
  skipWrite: boolean
  isCached: boolean
}

type Match = string | RegExp | string[]

const isRegex = (src: Match): src is RegExp => src instanceof RegExp
const isString = (src: Match): src is string => typeof src === 'string'
const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val)

export function deepMerge(...sources: unknown[]): unknown {
  const result: Record<string, unknown> = {}
  for (const source of sources) {
    if (!isPlainObject(source)) continue
    for (const key of Object.keys(source)) {
      if (isPlainObject(source[key]) && isPlainObject(result[key])) {
        result[key] = deepMerge(result[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
  }
  return result
}

export function readAllFiles(root: string) {
  let resultArr: string[] = []
  try {
    if (fs.existsSync(root)) {
      const stat = fs.lstatSync(root)
      if (stat.isDirectory()) {
        const files = fs.readdirSync(root)
        files.forEach((file) => {
          const t = readAllFiles(join(root, file))
          resultArr = resultArr.concat(t)
        })
      } else {
        resultArr.push(root)
      }
    }
  } catch (error) {
    console.log(error)
  }

  return resultArr
}

export function areFilesMatching(
  fileName: string,
  filePath: string,
  matcher: Match,
): boolean {
  if (isString(matcher)) return fileName === matcher
  if (isRegex(matcher)) return matcher.test(filePath)
  if (Array.isArray(matcher)) return matcher.includes(fileName)
  return false
}

export function logErrors(errorsMap: Map<string, string>): void {
  duiError('Image optimization errors:')
  for (const [name, message] of errorsMap) {
    duiError(`  ${name} — ${message}`)
  }
}

export function logOptimizationStats(sizesMap: Map<string, Sizes>): void {
  const headers = ['File', 'Savings', 'Original', 'Optimized', 'Status']
  const rows: string[][] = []

  let totalOriginalSize = 0
  let totalSavedSize = 0

  for (const [
    name,
    { size, oldSize, ratio, skipWrite, isCached },
  ] of sizesMap) {
    const savings = `${ratio > 0 ? '+' : ''}${ratio}%`
    const original = `${oldSize.toFixed(2)} kB`
    const optimized = `${size.toFixed(2)} kB`
    const status = skipWrite
      ? colors.yellow('skipped')
      : isCached
        ? colors.cyan('cached')
        : colors.green('optimized')
    rows.push([name, savings, original, optimized, status])

    if (!skipWrite) {
      totalOriginalSize += oldSize
      totalSavedSize += oldSize - size
    }
  }

  success('Image optimization results:')
  console.log(
    table(headers, rows, {
      style: 'round',
      headerSeparator: true,
    }),
  )

  if (totalSavedSize > 0) {
    const savedText = `${totalSavedSize.toFixed(2)} kB`
    const originalText = `${totalOriginalSize.toFixed(2)} kB`
    const savingsPercent = `${Math.round((totalSavedSize / totalOriginalSize) * 100)}%`
    info(`Total savings: ${savedText} / ${originalText} (${savingsPercent})`)
  }
}
