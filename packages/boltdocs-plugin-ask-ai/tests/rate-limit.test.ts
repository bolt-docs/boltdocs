import type { Connect } from 'vite'
import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, getClientIp } from '../src/node/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    // reset module-level buckets by exercising a fresh ip that will be capped
  })

  it('allows requests under the limit', () => {
    const result = rateLimit('ip-under', 30)
    expect(result).toEqual({ ok: true })
  })

  it('blocks after the limit is reached within the window', () => {
    const ip = 'ip-burst'
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(ip, 3)).toEqual({ ok: true })
    }
    const fourth = rateLimit(ip, 3)
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) {
      expect(fourth.retryAfter).toBeGreaterThanOrEqual(0)
    }
  })

  it('bounds the in-memory bucket registry', () => {
    for (let index = 0; index < 10_001; index += 1) {
      rateLimit(`bounded-${index}`, 1)
    }

    expect(rateLimit('bounded-0', 1)).toEqual({ ok: true })
  })

  it('is disabled when the limit is zero or negative', () => {
    expect(rateLimit('ip-unlimited', 0)).toEqual({ ok: true })
    expect(rateLimit('ip-unlimited', -5)).toEqual({ ok: true })
  })
})

describe('getClientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.1, 70.0.0.2' },
    }
    expect(getClientIp(req as unknown as Connect.IncomingMessage)).toBe(
      '203.0.113.1',
    )
  })

  it('falls back to x-real-ip', () => {
    const req = { headers: { 'x-real-ip': '1.2.3.4' } }
    expect(getClientIp(req as unknown as Connect.IncomingMessage)).toBe(
      '1.2.3.4',
    )
  })

  it('falls back to socket address', () => {
    const req = { headers: {}, socket: { remoteAddress: '9.9.9.9' } }
    expect(getClientIp(req as unknown as Connect.IncomingMessage)).toBe(
      '9.9.9.9',
    )
  })
})
