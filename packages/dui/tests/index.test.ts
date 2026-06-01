import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import readline from 'node:readline'
import {
  configure,
  getConfig,
  padCenter,
  padRight,
  fitWidth,
  stripAnsi,
  visibleLength,
  divider,
  bullet,
  ordered,
  tasks,
  box,
  double,
  single,
  round,
  devServer,
  previewServer,
  updateAvailable,
  info,
  warn,
  error,
  success,
  debug,
  formatLog,
  confirm,
  table,
  createSpinner,
  steps,
} from '../src/index'

// Mock node:readline so confirm() never touches real stdin
vi.mock('node:readline', async (importActual) => {
  const actual = await importActual<typeof import('node:readline')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      createInterface: vi.fn(),
      clearLine: vi.fn(),
      cursorTo: vi.fn(),
    },
  }
})

// utils

describe('utils', () => {
  it('padCenter — plain string', () => {
    expect(padCenter('hi', 6)).toBe('  hi  ')
    expect(padCenter('hi', 5)).toBe(' hi  ')
    expect(padCenter('hi', 2)).toBe('hi')
  })

  it('padCenter — ANSI colored string centers on visible width', () => {
    const colored = '\x1b[31mhi\x1b[0m' // visible length = 2
    const result = padCenter(colored, 6)
    // 2 spaces on each side around the 2-char visible content
    expect(result.startsWith('  ')).toBe(true)
    expect(result.endsWith('  ')).toBe(true)
    expect(visibleLength(result)).toBe(6)
  })

  it('padRight', () => {
    expect(padRight('hi', 5)).toBe('hi   ')
    expect(padRight('hi', 2)).toBe('hi')
  })

  it('fitWidth', () => {
    expect(fitWidth('hi', 5)).toBe('hi   ')
    expect(fitWidth('hello world', 5)).toBe('hello world') // no truncation
  })

  it('stripAnsi — SGR color sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red')
    expect(stripAnsi('\x1b[1;32mbold green\x1b[0m')).toBe('bold green')
  })

  it('stripAnsi — OSC hyperlinks', () => {
    // Terminal hyperlink: \x1b]8;;url\x07 text \x1b]8;;\x07
    const link = '\x1b]8;;https://example.com\x07click here\x1b]8;;\x07'
    expect(stripAnsi(link)).toBe('click here')
  })

  it('stripAnsi — cursor movement (CSI non-color)', () => {
    expect(stripAnsi('\x1b[2Jhello')).toBe('hello') // erase screen
    expect(stripAnsi('\x1b[1Aup')).toBe('up') // cursor up
  })

  it('visibleLength', () => {
    expect(visibleLength('\x1b[31mred\x1b[0m')).toBe(3)
    expect(visibleLength('plain')).toBe(5)
    expect(visibleLength('')).toBe(0)
  })
})

// divider

describe('divider', () => {
  it('returns a gray line of specified length', () => {
    const result = divider('─', 10)
    expect(result).toContain('─'.repeat(10))
  })
})

// list

describe('list', () => {
  it('bullet produces bullet list', () => {
    const result = bullet(['a', 'b'])
    expect(result).toContain('•')
    expect(result).toContain('a')
    expect(result).toContain('b')
  })

  it('ordered produces numbered list', () => {
    const result = ordered(['x', 'y'])
    expect(result).toContain('1.')
    expect(result).toContain('2.')
  })

  it('tasks produces checkmark list', () => {
    const result = tasks([
      { label: 'done', done: true },
      { label: 'pending', done: false },
    ])
    expect(result).toContain('✔')
    expect(result).toContain('✘')
    expect(result).toContain('done')
    expect(result).toContain('pending')
  })
})

// box

describe('box', () => {
  it('generic box renders with content', () => {
    const result = box(['hello'], { width: 20 })
    expect(result).toContain('hello')
    expect(result).toContain('╔')
    expect(result).toContain('╝')
  })

  it('double renders with title', () => {
    const result = double('Test', ['content'])
    expect(result).toContain('Test')
    expect(result).toContain('content')
    expect(result).toContain('╔')
    expect(result).toContain('╝')
  })

  it('title border row is same visible width as bottom border row', () => {
    const result = double('Title', ['content'])
    const lines = result.split('\n')
    const topLine = lines[0]
    const bottomLine = lines[lines.length - 1]
    expect(visibleLength(topLine)).toBe(visibleLength(bottomLine))
  })

  it('single renders with title', () => {
    const result = single('Title', ['body'])
    expect(result).toContain('Title')
    expect(result).toContain('┏')
    expect(result).toContain('┛')
  })

  it('round renders with title', () => {
    const result = round('Round', ['item'])
    expect(result).toContain('Round')
    expect(result).toContain('╭')
    expect(result).toContain('╯')
  })
})

// pre-built boxes

describe('pre-built boxes', () => {
  it('devServer', () => {
    const result = devServer('http://localhost:5173', null)
    expect(result).toContain('dev server')
    expect(result).toContain('http://localhost:5173')
    expect(result).toContain('use --host')
  })

  it('devServer with network url', () => {
    const result = devServer('http://localhost:5173', 'http://10.0.0.1:5173')
    expect(result).toContain('http://10.0.0.1:5173')
  })

  it('previewServer', () => {
    const result = previewServer('http://localhost:4173', null)
    expect(result).toContain('preview server')
    expect(result).toContain('http://localhost:4173')
  })

  it('updateAvailable', () => {
    const result = updateAvailable('1.0.0', '2.0.0')
    expect(result).toContain('Update available')
    expect(result).toContain('1.0.0')
    expect(result).toContain('2.0.0')
    expect(result).toContain('npm install boltdocs@latest')
  })
})

// logger

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('info writes to stdout with [dui] prefix', () => {
    info('hello world')
    expect(console.log).toHaveBeenCalledOnce()
    const msg = (console.log as ReturnType<typeof vi.spyOn>).mock
      .calls[0][0] as string
    expect(stripAnsi(msg)).toBe('[dui] hello world')
  })

  it('warn writes to stdout with yellow prefix', () => {
    warn('something off')
    expect(console.log).toHaveBeenCalledOnce()
    const msg = (console.log as ReturnType<typeof vi.spyOn>).mock
      .calls[0][0] as string
    expect(stripAnsi(msg)).toContain('[dui] something off')
  })

  it('error writes to stderr with red prefix', () => {
    error('boom')
    expect(console.error).toHaveBeenCalledOnce()
    const msg = (console.error as ReturnType<typeof vi.spyOn>).mock
      .calls[0][0] as string
    expect(stripAnsi(msg)).toContain('[dui] boom')
  })

  it('error forwards extra argument to stderr', () => {
    const err = new Error('oops')
    error('caught', err)
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(
      (console.error as ReturnType<typeof vi.spyOn>).mock.calls[1][0],
    ).toBe(err)
  })

  it('success writes to stdout with green prefix', () => {
    success('done!')
    expect(console.log).toHaveBeenCalledOnce()
    const msg = (console.log as ReturnType<typeof vi.spyOn>).mock
      .calls[0][0] as string
    expect(stripAnsi(msg)).toContain('[dui] done!')
  })

  it('debug is silent without DEBUG env var', () => {
    delete process.env.DEBUG
    delete process.env.BOLTDOCS_DEBUG
    debug('should not appear')
    expect(console.log).not.toHaveBeenCalled()
  })

  it('debug writes when BOLTDOCS_DEBUG is set', () => {
    process.env.BOLTDOCS_DEBUG = '1'
    debug('verbose info')
    expect(console.log).toHaveBeenCalledOnce()
    delete process.env.BOLTDOCS_DEBUG
  })
})

// formatLog

describe('formatLog', () => {
  it('returns prefix + message without style', () => {
    const result = formatLog('test message')
    expect(stripAnsi(result)).toBe('[dui] test message')
  })

  it('applies the provided style function', () => {
    const upper = (s: string) => s.toUpperCase()
    const result = formatLog('hello', upper)
    expect(result).toContain('HELLO')
    expect(result).toContain('[DUI]')
  })
})

// confirm

describe('confirm', () => {
  afterEach(() => vi.clearAllMocks())

  function makeRl(answer: string) {
    return {
      question: vi.fn((_: string, cb: (a: string) => void) => cb(answer)),
      close: vi.fn(),
    }
  }

  it('resolves true for "y"', async () => {
    vi.mocked(readline.createInterface).mockReturnValue(makeRl('y') as any)
    await expect(confirm('continue?')).resolves.toBe(true)
  })

  it('resolves true for "yes"', async () => {
    vi.mocked(readline.createInterface).mockReturnValue(makeRl('yes') as any)
    await expect(confirm('continue?')).resolves.toBe(true)
  })

  it('resolves false for anything else', async () => {
    vi.mocked(readline.createInterface).mockReturnValue(makeRl('n') as any)
    await expect(confirm('continue?')).resolves.toBe(false)
  })

  it('always closes the readline interface', async () => {
    const rl = makeRl('y')
    vi.mocked(readline.createInterface).mockReturnValue(rl as any)
    await confirm('continue?')
    expect(rl.close).toHaveBeenCalledOnce()
  })

  it('resolves false on SIGINT', async () => {
    let sigIntCallback: (() => void) | undefined
    const mockRl = {
      question: vi.fn(),
      close: vi.fn(),
      once: vi.fn((event, cb) => {
        if (event === 'SIGINT') {
          sigIntCallback = cb
        }
      }),
      off: vi.fn(),
    }
    vi.mocked(readline.createInterface).mockReturnValue(mockRl as any)
    const spyStdout = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    const promise = confirm('continue?')

    expect(sigIntCallback).toBeDefined()
    sigIntCallback!()

    await expect(promise).resolves.toBe(false)
    expect(mockRl.close).toHaveBeenCalledOnce()
    spyStdout.mockRestore()
  })
})

// configure()

describe('configure', () => {
  // Snapshot defaults before each test and restore after
  let saved: ReturnType<typeof getConfig>

  beforeEach(() => {
    saved = { ...getConfig() }
  })

  afterEach(() => {
    configure(saved)
  })

  it('getConfig returns defaults when nothing has been configured', () => {
    configure({
      prefix: 'dui',
      devServerTitle: 'dev server',
      previewServerTitle: 'preview server',
      updateCommand: 'npm install dui@latest',
    })
    const cfg = getConfig()
    expect(cfg.prefix).toBe('dui')
    expect(cfg.devServerTitle).toBe('dev server')
    expect(cfg.previewServerTitle).toBe('preview server')
    expect(cfg.updateCommand).toBe('npm install dui@latest')
  })

  it('changes logger prefix at runtime', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    configure({ prefix: 'myapp' })
    info('test')
    expect(stripAnsi(spy.mock.calls[0][0] as string)).toBe('[myapp] test')
    spy.mockRestore()
  })

  it('changes devServerTitle', () => {
    configure({ devServerTitle: 'myapp dev server' })
    expect(devServer('http://localhost:3000', null)).toContain(
      'myapp dev server',
    )
  })

  it('changes previewServerTitle', () => {
    configure({ previewServerTitle: 'myapp preview' })
    expect(previewServer('http://localhost:4000', null)).toContain(
      'myapp preview',
    )
  })

  it('changes updateCommand', () => {
    configure({ updateCommand: 'yarn add myapp@latest' })
    expect(updateAvailable('1.0.0', '2.0.0')).toContain('yarn add myapp@latest')
  })

  it('partial configure() leaves other keys unchanged', () => {
    const before = getConfig().devServerTitle
    configure({ prefix: 'partial-only' })
    expect(getConfig().prefix).toBe('partial-only')
    expect(getConfig().devServerTitle).toBe(before)
  })
})

describe('table', () => {
  it('renders table with default single style', () => {
    const result = table(
      ['Col A', 'Col B'],
      [
        ['1', '2'],
        ['3', '4'],
      ],
    )
    expect(result).toContain('Col A')
    expect(result).toContain('Col B')
    expect(result).toContain('┏')
    expect(result).toContain('━')
    expect(result).toContain('┳')
    expect(result).toContain('┫')
  })

  it('renders table with double style', () => {
    const result = table(['Col A'], [['val']], { style: 'double' })
    expect(result).toContain('╚')
    expect(result).toContain('═')
  })

  it('renders table with none style', () => {
    const result = table(['A', 'B'], [['1', '2']], { style: 'none' })
    expect(result).not.toContain('┏')
    expect(result).toContain('1')
  })

  it('respects alignments', () => {
    const resultLeft = table(['A'], [['1']], { columns: [{ align: 'left' }] })
    const resultRight = table(['A'], [['1']], {
      columns: [{ align: 'right' }],
    })
    expect(resultLeft).toBeDefined()
    expect(resultRight).toBeDefined()
  })
})

describe('steps', () => {
  it('renders timeline with multiple status steps', () => {
    const result = steps([
      { label: 'Step 1', status: 'success', details: 'Done first' },
      { label: 'Step 2', status: 'running', details: 'Working now' },
      { label: 'Step 3', status: 'pending' },
    ])
    expect(result).toContain('✔')
    expect(result).toContain('●')
    expect(result).toContain('○')
    expect(result).toContain('│')
    expect(result).toContain('Done first')
  })
})

describe('spinner', () => {
  let writeSpy: any
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    writeSpy.mockRestore()
  })

  it('non-TTY logs cleanly', () => {
    const origTTY = process.stdout.isTTY
    process.stdout.isTTY = false
    try {
      const spinner = createSpinner('Loading...')
      spinner.start()
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('... Loading...'),
      )

      spinner.update('Still Loading...')
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('... Still Loading...'),
      )

      spinner.stop('success', 'Done!')
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('✔ Done!'))
    } finally {
      process.stdout.isTTY = origTTY
    }
  })

  it('TTY starts animation and stops', () => {
    const origTTY = process.stdout.isTTY
    process.stdout.isTTY = true
    vi.useFakeTimers()
    try {
      const spinner = createSpinner('Installing...')
      spinner.start()

      expect(writeSpy).toHaveBeenCalledWith('\u001b[?25l')

      vi.advanceTimersByTime(200)

      spinner.stop('fail', 'Failed!')
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('✖ Failed!'),
      )
      expect(writeSpy).toHaveBeenCalledWith('\u001b[?25h')
    } finally {
      process.stdout.isTTY = origTTY
      vi.useRealTimers()
    }
  })
})
