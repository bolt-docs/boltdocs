import readline from 'node:readline'
import { colors } from './colors'

export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    const prompt = colors.yellow(colors.bold(`[boltdocs] ${message}`))
    rl.question(`${prompt} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export function formatLog(message: string, style?: (s: string) => string): string {
  const prefix = colors.bold('[boltdocs]')
  const full = `${prefix} ${message}`
  return style ? style(full) : full
}
