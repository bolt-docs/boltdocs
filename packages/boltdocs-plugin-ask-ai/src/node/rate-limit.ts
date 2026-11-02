import type { Connect } from 'vite'

const RATE_WINDOW_MS = 60_000
const MAX_RATE_BUCKETS = 10_000
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function pruneRateBuckets(now: number): void {
  if (rateBuckets.size < MAX_RATE_BUCKETS) return
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key)
  }
  while (rateBuckets.size >= MAX_RATE_BUCKETS) {
    const oldestKey = rateBuckets.keys().next().value as string | undefined
    if (!oldestKey) break
    rateBuckets.delete(oldestKey)
  }
}

type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export function rateLimit(ip: string, maxPerMinute: number): RateLimitResult {
  if (maxPerMinute <= 0) return { ok: true }
  const now = Date.now()
  pruneRateBuckets(now)
  const entry = rateBuckets.get(ip)
  if (!entry || entry.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return { ok: true }
  }
  if (entry.count >= maxPerMinute) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { ok: true }
}

export function getClientIp(req: Connect.IncomingMessage): string {
  const xff =
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() || (req.headers['x-real-ip'] as string | undefined)?.trim()
  if (xff) return xff
  return req.socket?.remoteAddress || 'unknown'
}
