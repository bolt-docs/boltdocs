import { colors } from './colors'

export interface StepItem {
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  details?: string
}

export function steps(items: StepItem[]): string {
  const result: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const isLast = i === items.length - 1

    let icon = ''
    switch (item.status) {
      case 'success':
        icon = colors.green('✔')
        break
      case 'error':
        icon = colors.red('✖')
        break
      case 'running':
        icon = colors.cyan('●')
        break
      case 'pending':
        icon = colors.gray('○')
        break
    }

    const titleStyle =
      item.status === 'running'
        ? colors.bold
        : item.status === 'pending'
          ? colors.dim
          : (s: string) => s
    result.push(`  ${icon}  ${titleStyle(item.label)}`)

    if (item.details) {
      const connector = isLast ? ' ' : '│'
      result.push(`  ${connector}  └─ ${colors.dim(item.details)}`)
    }

    if (!isLast) {
      result.push('  │')
    }
  }

  return result.join('\n')
}
