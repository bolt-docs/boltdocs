export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED'
export const AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR'
export const AI_TIMEOUT = 'AI_TIMEOUT'
export const ADAPTER_ERROR = 'ADAPTER_ERROR'

/** Never return arbitrary upstream/parser messages to an untrusted client. */
export function toPublicProviderError(): string {
  return AI_PROVIDER_ERROR
}
