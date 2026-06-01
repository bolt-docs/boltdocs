import readline from 'node:readline'
import { colors } from './colors'
import { getConfig } from './config'

export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    const p = colors.yellow(colors.bold(`[${getConfig().prefix}] ${message}`))

    const onSigInt = () => {
      rl.close()
      process.stdout.write('\n')
      resolve(false)
    }

    if (typeof rl.once === 'function') {
      rl.once('SIGINT', onSigInt)
    }

    rl.question(`${p} (y/N): `, (answer) => {
      if (typeof rl.off === 'function') {
        rl.off('SIGINT', onSigInt)
      }
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export function formatLog(
  message: string,
  style?: (s: string) => string,
): string {
  const p = colors.bold(`[${getConfig().prefix}]`)
  const full = `${p} ${message}`
  return style ? style(full) : full
}
