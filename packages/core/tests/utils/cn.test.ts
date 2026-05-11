import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn } from '../../src/client/utils/cn'

describe('cn - classnames utility', () => {
  it('should merge simple class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('should merge multiple class names', () => {
    const result = cn('foo', 'bar', 'baz')
    expect(result).toBe('foo bar baz')
  })

  it('should handle conditional strings', () => {
    const result = cn('foo', false && 'bar', 'baz')
    expect(result).toBe('foo baz')
  })

  it('should handle conditional with true', () => {
    const result = cn('foo', true && 'bar', 'baz')
    expect(result).toBe('foo bar baz')
  })

  it('should handle undefined values', () => {
    const result = cn('foo', undefined, 'bar')
    expect(result).toBe('foo bar')
  })

  it('should handle null values', () => {
    const result = cn('foo', null, 'bar')
    expect(result).toBe('foo bar')
  })

  it('should handle empty strings', () => {
    const result = cn('foo', '', 'bar')
    expect(result).toBe('foo bar')
  })

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar'], 'baz')
    expect(result).toBe('foo bar baz')
  })

  it('should handle objects', () => {
    const result = cn({ foo: true, bar: false, baz: true })
    expect(result).toBe('foo baz')
  })

  it('should handle mixed inputs', () => {
    const result = cn('foo', ['bar', 'baz'], { qux: true, quux: false }, true && 'quuz')
    expect(result).toBe('foo bar baz qux quuz')
  })

  it('should handle tailwind-merge conflicts', () => {
    const result = cn('px-2 py-1', 'py-2')
    expect(result).toBe('px-2 py-2')
  })

  it('should handle multiple tailwind conflicts', () => {
    const result = cn('text-lg font-bold', 'text-sm', 'font-normal')
    expect(result).toBe('text-sm font-normal')
  })

  it('should handle empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle zero as value', () => {
    const result = cn('foo', 0, 'bar')
    expect(result).toBe('foo bar')
  })
})