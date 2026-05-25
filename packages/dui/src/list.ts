import { colors } from './colors'

export interface TaskItem {
  label: string
  done: boolean
}

export function bullet(items: string[], indent = 0): string {
  const pad = '  '.repeat(indent)
  return items.map((item) => `${pad}${colors.dim('•')}${colors.reset} ${item}`).join('\n')
}

export function ordered(items: string[], start = 1): string {
  return items
    .map((item, i) => {
      const num = start + i
      return `${colors.dim(`${num}.`)}${colors.reset} ${item}`
    })
    .join('\n')
}

export function tasks(items: TaskItem[], indent = 0): string {
  const pad = '  '.repeat(indent)
  return items
    .map((item) => {
      const icon = item.done ? `${colors.green}✔${colors.reset}` : `${colors.red}✘${colors.reset}`
      return `${pad}${icon} ${item.label}`
    })
    .join('\n')
}
