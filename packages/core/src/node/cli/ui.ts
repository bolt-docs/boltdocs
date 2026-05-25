import readline from 'node:readline'
import * as dui from '@bdocs/dui'

export const colors = dui.colors

export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    const prompt = dui.colors.yellow(dui.colors.bold(`[boltdocs] ${message}`))
    rl.question(`${prompt} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export function formatLog(message: string, style?: (s: string) => string): string {
  const prefix = dui.colors.bold('[boltdocs]')
  const full = `${prefix} ${message}`
  return style ? style(full) : full
}

export function info(message: string) {
  dui.info(message)
}

export function warn(message: string) {
  dui.warn(message)
}

export function error(message: string, error?: any) {
  dui.error(message, error)
}

export function success(message: string) {
  dui.success(message)
}

export function divider() {
  dui.dividerLog()
}

export function box(title: string) {
  console.log(dui.single(title, []))
}

export function printDevServerInfo(localUrl: string, networkUrl: string | null): void {
  console.log(dui.devServer(localUrl, networkUrl))
}

export function printPreviewServerInfo(localUrl: string, networkUrl: string | null): void {
  console.log(dui.previewServer(localUrl, networkUrl))
}
