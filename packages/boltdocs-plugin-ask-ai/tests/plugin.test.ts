import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@bdocs/dui', () => ({
  info: vi.fn(),
  warn: vi.fn(),
}))

const { default: askAiPlugin } = await import('../src/node/index')

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-private-provider-value')
  vi.stubEnv('BOLTDOCS_ASK_AI_TEST_SECRET', 'private-shared-secret-value')
})

describe('askAiPlugin', () => {
  it('registers the floating slot with a statically analyzable export', () => {
    const plugin = askAiPlugin()

    expect(plugin.client?.slots).toEqual({
      'floating:after': '@bdocs/plugin-ask-ai/client#AskAiBubble',
    })
  })

  it('never copies server secrets or private prompts into metadata', () => {
    const plugin = askAiPlugin({
      title: 'Docs title is public',
      secretKeyEnv: 'BOLTDOCS_ASK_AI_TEST_SECRET',
      systemPrompt: 'PRIVATE_SYSTEM_PROMPT',
      persona: 'PRIVATE_PERSONA',
      baseURL: 'https://private-proxy.example.test/v1',
    })
    const serialized = JSON.stringify(plugin.metadata)

    expect(serialized).toContain('Docs title is public')
    expect(serialized).not.toContain('private-shared-secret-value')
    expect(serialized).not.toContain('sk-private-provider-value')
    expect(serialized).not.toContain('PRIVATE_SYSTEM_PROMPT')
    expect(serialized).not.toContain('PRIVATE_PERSONA')
    expect(serialized).not.toContain('private-proxy.example.test')
  })

  it('rejects a resolved server secret shorter than 16 characters', () => {
    vi.stubEnv('BOLTDOCS_ASK_AI_TEST_SECRET', 'too-short')

    expect(() =>
      askAiPlugin({ secretKeyEnv: 'BOLTDOCS_ASK_AI_TEST_SECRET' }),
    ).toThrow('secretKeyEnv must resolve to at least 16 characters')
  })

  it('publishes only safe UI metadata and class-name slots', () => {
    const plugin = askAiPlugin({
      title: 'Docs title is public',
      classNames: { panel: 'w-96 rounded-3xl' },
    })

    expect(plugin.metadata).toMatchObject({
      title: 'Docs title is public',
      classNames: { panel: 'w-96 rounded-3xl' },
    })
    expect(plugin.metadata).not.toHaveProperty('secretKey')
    expect(plugin.metadata).not.toHaveProperty('secretKeyEnv')
    expect(plugin.metadata).not.toHaveProperty('baseURL')
    expect(plugin.metadata).not.toHaveProperty('systemPrompt')
  })
})
