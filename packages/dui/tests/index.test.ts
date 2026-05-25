import { describe, it, expect } from 'vitest'
import {
  padCenter,
  padLeft,
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
} from '../src/index'

describe('utils', () => {
  it('padCenter', () => {
    expect(padCenter('hi', 6)).toBe('  hi  ')
    expect(padCenter('hi', 5)).toBe(' hi  ')
    expect(padCenter('hi', 2)).toBe('hi')
  })

  it('padLeft', () => {
    expect(padLeft('hi', 5)).toBe('hi   ')
    expect(padLeft('hi', 2)).toBe('hi')
  })

  it('fitWidth', () => {
    expect(fitWidth('hi', 5)).toBe('hi   ')
  })

  it('stripAnsi and visibleLength', () => {
    const colored = '\x1b[31mred\x1b[0m'
    expect(stripAnsi(colored)).toBe('red')
    expect(visibleLength(colored)).toBe(3)
    expect(visibleLength('plain')).toBe(5)
  })
})

describe('divider', () => {
  it('returns a gray line of specified length', () => {
    const result = divider('─', 10)
    expect(result).toContain('─'.repeat(10))
  })
})

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

describe('box', () => {
  it('generic box renders with content', () => {
    const result = box(['hello'], { width: 20 })
    expect(result).toContain('hello')
    expect(result).toContain('╔')
    expect(result).toContain('╝')
  })

  it('double renders with title', () => {
    const result = double('Test', ['content'],)
    expect(result).toContain('Test')
    expect(result).toContain('content')
    expect(result).toContain('╔')
    expect(result).toContain('╝')
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

describe('pre-built boxes', () => {
  it('devServer', () => {
    const result = devServer('http://localhost:5173', null)
    expect(result).toContain('boltdocs dev server')
    expect(result).toContain('http://localhost:5173')
    expect(result).toContain('use --host')
  })

  it('devServer with network url', () => {
    const result = devServer('http://localhost:5173', 'http://10.0.0.1:5173')
    expect(result).toContain('http://10.0.0.1:5173')
  })

  it('previewServer', () => {
    const result = previewServer('http://localhost:4173', null)
    expect(result).toContain('boltdocs preview server')
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
