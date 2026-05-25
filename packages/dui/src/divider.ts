import { terminalWidth } from './utils'
import { colors } from './colors'

export function divider(char = '─', len?: number): string {
  const width = len ?? Math.min(terminalWidth(), 72)
  return colors.gray(char.repeat(width))
}

export function dividerLog(char = '─', len?: number): void {
  console.log(divider(char, len))
}
