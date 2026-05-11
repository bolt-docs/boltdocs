import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copyToClipboard } from '../../src/client/utils/copy-clipboard'

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should copy text using navigator.clipboard', async () => {
    const result = await copyToClipboard('Hello World')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello World')
    expect(result).toBe(true)
  })

  it('should return true on success', async () => {
    const result = await copyToClipboard('Test text')
    expect(result).toBe(true)
  })

  it('should handle empty string', async () => {
    const result = await copyToClipboard('')
    expect(result).toBe(true)
  })

  it('should handle long text', async () => {
    const longText = 'a'.repeat(10000)
    const result = await copyToClipboard(longText)
    expect(result).toBe(true)
  })

  it('should handle special characters', async () => {
    const specialText = 'Hello <World> & "test" \'chars\''
    const result = await copyToClipboard(specialText)
    expect(result).toBe(true)
  })

  it('should handle unicode characters', async () => {
    const unicodeText = '你好世界 🌍 🎉'
    const result = await copyToClipboard(unicodeText)
    expect(result).toBe(true)
  })
})