import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  hasSearchGenerator,
  registerSearchGenerator,
  resetSearchRegistry,
} from '../../src/node/search/registry'
import { SearchNoticeStep } from '../../src/node/pipeline/steps/search-notice'

const warn = vi.fn()
const info = vi.fn()

vi.mock('@bdocs/dui', () => ({
  warn: (m: string) => warn(m),
  info: (m: string) => info(m),
  error: (m: string) => warn(m),
  debug: () => {},
}))

/**
 * The notice is the only feedback a site gets that its search index will not
 * be built. Two properties matter and they pull in opposite directions: it must
 * stay quiet for a site that deliberately has no search, and it must not cry
 * wolf for a site that configured the plugin.
 */
describe('SearchNoticeStep', () => {
  beforeEach(() => {
    resetSearchRegistry()
    warn.mockClear()
    info.mockClear()
  })

  it('says nothing at all when a search plugin registered', async () => {
    registerSearchGenerator(() => [])
    await new SearchNoticeStep().execute({} as never)

    // The false alarm is the failure worth preventing: a site that configured
    // `@bdocs/plugin-search` and is told it has none will go looking for a bug
    // that does not exist.
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('reports the absence at info level, not warn', async () => {
    await new SearchNoticeStep().execute({} as never)

    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0][0]).toContain('@bdocs/plugin-search')
    // Warn would train people to ignore build output, which is what the SEO
    // notice already risks on sites that legitimately configure nothing.
    expect(warn).not.toHaveBeenCalled()
  })

  it('reflects a plugin that registered after construction', async () => {
    const step = new SearchNoticeStep()
    expect(hasSearchGenerator()).toBe(false)

    // Registration happens in the `build:routes` hook, which fires before this
    // step runs — but the step is constructed earlier, when the pipeline is
    // built. It must read the registry at execution time, not at construction.
    registerSearchGenerator(() => [])
    await step.execute({} as never)

    expect(info).not.toHaveBeenCalled()
  })
})
