import { colors } from './colors'

export function bullet(items: string[]): string {
  const pad = '  '
  return items.map((item) => `${pad}${colors.dim('•')} ${item}`).join('\n')
}

export function ordered(items: string[]): string {
  return items
    .map((item, i) => {
      const num = `${i + 1}.`
      return `  ${colors.dim(num)} ${item}`
    })
    .join('\n')
}

export interface TaskItem {
  label: string
  done: boolean
}

export function tasks(items: TaskItem[]): string {
  return items
    .map((item) => {
      const icon = item.done ? colors.green('✔') : colors.red('✘')
      return `  ${icon} ${item.label}`
    })
    .join('\n')
}
