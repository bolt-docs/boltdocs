import readline from 'node:readline'
import { colors } from './colors'
import { getConfig } from './config'

export interface SpinnerOptions {
  prefix?: string
}

export interface Spinner {
  start: () => void
  update: (newMessage: string) => void
  stop: (
    status?: 'success' | 'fail' | 'warn' | 'info',
    finalMessage?: string,
  ) => void
}

export function createSpinner(message: string, opts?: SpinnerOptions): Spinner {
  let timer: NodeJS.Timeout | null = null
  let frameIndex = 0
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const prefix = opts?.prefix ?? getConfig().prefix
  const formattedPrefix = colors.bold(`[${prefix}]`)
  const isTTY = process.stdout.isTTY

  const start = () => {
    if (isTTY) {
      process.stdout.write('\u001b[?25l') // Hide cursor

      const render = () => {
        const frame = colors.cyan(frames[frameIndex])
        frameIndex = (frameIndex + 1) % frames.length

        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        process.stdout.write(`${formattedPrefix} ${frame} ${message}`)
      }
      render()
      timer = setInterval(render, 80)
    } else {
      process.stdout.write(`${formattedPrefix} ... ${message}\n`)
    }
  }

  const update = (newMessage: string) => {
    message = newMessage
    if (!isTTY) {
      process.stdout.write(`${formattedPrefix} ... ${message}\n`)
    }
  }

  const stop = (
    status: 'success' | 'fail' | 'warn' | 'info' = 'success',
    finalMessage?: string,
  ) => {
    const text = finalMessage ?? message
    let symbol = ''
    switch (status) {
      case 'success':
        symbol = colors.green('✔')
        break
      case 'fail':
        symbol = colors.red('✖')
        break
      case 'warn':
        symbol = colors.yellow('⚠')
        break
      case 'info':
        symbol = colors.blue('ℹ')
        break
    }

    if (timer) {
      clearInterval(timer)
      timer = null
    }

    if (isTTY) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      process.stdout.write(`${formattedPrefix} ${symbol} ${text}\n`)
      process.stdout.write('\u001b[?25h') // Show cursor
    } else {
      process.stdout.write(`${formattedPrefix} ${symbol} ${text}\n`)
    }
  }

  return { start, update, stop }
}
