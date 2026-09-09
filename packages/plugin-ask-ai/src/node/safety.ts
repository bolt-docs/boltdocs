export const DEFAULT_DENY_PATTERNS: RegExp[] = [
  /\bignore (?:all |the )?(?:previous|above|prior) instructions?\b/i,
  /\bdisregard (?:all |the )?(?:previous|above|prior) (?:prompts?|instructions?)\b/i,
  /\breveal (?:your|the) (?:system|initial) prompt\b/i,
  /\bjailbreak\b/i,
  /\bdeveloper mode\b/i,
  /\bDAN\b/,
]

type SafetyResult = { ok: true } | { ok: false; reason: string }

export function checkInputSafety(
  question: string,
  maxChars: number,
  denyPatterns: RegExp[],
): SafetyResult {
  if (!question || typeof question !== 'string') {
    return { ok: false, reason: 'EMPTY_QUESTION' }
  }
  if (question.length > maxChars) {
    return {
      ok: false,
      reason: `QUESTION_TOO_LONG (max ${maxChars} chars, got ${question.length})`,
    }
  }
  for (const pattern of denyPatterns) {
    if (pattern.test(question)) {
      return { ok: false, reason: 'QUESTION_BLOCKED_BY_POLICY' }
    }
  }
  return { ok: true }
}
