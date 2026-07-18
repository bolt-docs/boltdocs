import { describe, it, expect } from 'vitest'
import { matchesCondition } from '../../src/client/hooks/use-slot-registry'
import {
  generateLayoutSlotsCode,
  SlotDeclarationSchema,
  UserSlotConfigSchema,
} from '../../src/node/plugin/layout-slots'

describe('SlotDeclarationSchema', () => {
  it('accepts a valid declaration without named export', () => {
    const parsed = SlotDeclarationSchema.parse({
      id: 'floating-bottom',
      modulePath: '@bdocs/plugin-ask-ai/client',
    })
    expect(parsed.component).toBeUndefined()
    expect(parsed.id).toBe('floating-bottom')
  })

  it('accepts a valid declaration with named export', () => {
    const parsed = SlotDeclarationSchema.parse({
      id: 'right-rail',
      modulePath: '@bdocs/plugin-ask-ai/client',
      component: 'AskAiDialog',
    })
    expect(parsed.component).toBe('AskAiDialog')
  })

  it('rejects empty id', () => {
    expect(() =>
      SlotDeclarationSchema.parse({ id: '', modulePath: 'x' }),
    ).toThrow()
  })

  it('rejects id too long', () => {
    expect(() =>
      SlotDeclarationSchema.parse({ id: 'a'.repeat(81), modulePath: 'x' }),
    ).toThrow()
  })

  it('rejects empty modulePath', () => {
    expect(() =>
      SlotDeclarationSchema.parse({ id: 'x', modulePath: '' }),
    ).toThrow()
  })
})

describe('UserSlotConfigSchema', () => {
  it('parses string as replace shorthand', () => {
    const parsed = UserSlotConfigSchema.parse('~/MyComp.tsx')
    expect(parsed).toEqual({ replace: '~/MyComp.tsx' })
  })

  it('parses object with replace', () => {
    const parsed = UserSlotConfigSchema.parse({ replace: '~/A.tsx' })
    expect(parsed).toEqual({ replace: '~/A.tsx' })
  })

  it('parses object with append', () => {
    const parsed = UserSlotConfigSchema.parse({ append: '~/B.tsx' })
    expect(parsed).toEqual({ append: '~/B.tsx' })
  })

  it('parses object with disable true', () => {
    const parsed = UserSlotConfigSchema.parse({ disable: true })
    expect(parsed).toEqual({ disable: true })
  })
})

describe('generateLayoutSlotsCode', () => {
  it('emits empty registry when no plugins declare slots', () => {
    const code = generateLayoutSlotsCode({ pluginDeclarations: [] })
    expect(code).toContain('export const slotRegistry')
    expect(code).toContain('export default slotRegistry')
    expect(code).not.toContain('import')
  })

  it('emits import + named-export expression for a single declaration', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            component: 'AskAiBubble',
          },
        },
      ],
    })
    // Scoped package `@bdocs` is stripped of the leading `@`, then the
    // remaining `/` and `-` characters collapse to `_`. The numeric prefix
    // is `_Slot0_` since this is the first import emitted.
    expect(code).toContain(
      `import * as _Slot0_bdocs_plugin_ask_ai_client from "@bdocs/plugin-ask-ai/client"`,
    )
    expect(code).toContain(`_Slot0_bdocs_plugin_ask_ai_client["AskAiBubble"]`)
    expect(code).toContain(`"floating-bottom"`)
  })

  it('emits .default expression when component name is omitted', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'right-rail',
            modulePath: '@bdocs/plugin-ask-ai/client',
          },
        },
      ],
    })
    expect(code).toContain(`.default`)
  })

  it('groups multiple plugin declarations by id', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'p1',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@p1/client',
            component: 'Badge',
          },
        },
        {
          pluginName: 'p2',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@p2/client',
            component: 'Stat',
          },
        },
      ],
    })
    expect(code).toContain(`"navbar-extra"`)
    expect(code.match(/import \* as/g)?.length).toBe(2)
    // Both components should appear in the array literal
    expect(code).toMatch(
      /\["Badge"\][\s\S]*\["Stat"\]|\["Stat"\][\s\S]*\["Badge"\]/,
    )
  })

  it('deduplicates imports for the same modulePath', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'p1',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@shared/client',
            component: 'A',
          },
        },
        {
          pluginName: 'p2',
          declaration: {
            id: 'right-rail',
            modulePath: '@shared/client',
            component: 'B',
          },
        },
      ],
    })
    expect(code.match(/from "@shared\/client"/g)?.length).toBe(1)
  })

  it('respects user disable and removes the slot entirely', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            component: 'AskAiBubble',
          },
        },
      ],
      userConfig: { 'floating-bottom': { disable: true } },
    })
    expect(code).not.toContain(`"floating-bottom"`)
    expect(code).not.toContain('import')
  })

  it('user replace presets the slot and discards plugin items', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            component: 'AskAiBubble',
          },
        },
      ],
      userConfig: { 'floating-bottom': { replace: '~/MyBubble.tsx' } },
    })
    expect(code).toContain(`from "~/MyBubble.tsx"`)
    expect(code).not.toContain(`AskAiBubble`)
  })

  it('user append keeps plugin items and adds the user module after', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            component: 'AskAiBubble',
          },
        },
      ],
      userConfig: { 'floating-bottom': { append: '~/HelpTip.tsx' } },
    })
    expect(code).toContain(`["AskAiBubble"]`)
    expect(code).toContain(`from "~/HelpTip.tsx"`)
    // Walk brackets from the slot's `[` to find the matching `]` (the
    // first `]` we encounter belongs to the index-access `["AskAiBubble"]`,
    // not the array close, so a non-greedy regex would over-match).
    const start = code.indexOf('"floating-bottom":')
    expect(start).toBeGreaterThan(-1)
    const openBracket = code.indexOf('[', start)
    let depth = 1
    let i = openBracket + 1
    while (i < code.length && depth > 0) {
      const ch = code[i]
      if (ch === '[') depth++
      else if (ch === ']') depth--
      i++
    }
    const section = code.slice(openBracket + 1, i - 1)
    expect(section).toContain('AskAiBubble')
    expect(section).toContain('HelpTip')
    expect(section.indexOf('AskAiBubble')).toBeLessThan(
      section.indexOf('HelpTip'),
    )
  })

  it('accepts user replace via string shorthand', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'right-rail',
            modulePath: '@bdocs/plugin-ask-ai/client',
            component: 'AskAiDialog',
          },
        },
      ],
      userConfig: { 'right-rail': '~/MySidebar.tsx' },
    })
    expect(code).toContain(`from "~/MySidebar.tsx"`)
    expect(code).not.toContain(`AskAiDialog`)
  })

  it('includes user-only slots (no plugin declaration) for replace', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [],
      userConfig: { 'navbar-extra': '~/MyBadge.tsx' },
    })
    expect(code).toContain(`"navbar-extra"`)
    expect(code).toContain(`from "~/MyBadge.tsx"`)
  })

  it('resolves export alias as component name', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'right-rail',
            modulePath: '@bdocs/plugin-ask-ai/client',
            export: 'AskAiDialog',
          },
        },
      ],
    })
    expect(code).toContain('["AskAiDialog"]')
    expect(code).not.toContain('.default')
  })

  it('auto-resolves modulePath from clientEntry when modulePath is omitted', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          clientEntry: '@bdocs/plugin-ask-ai/client',
          declaration: {
            id: 'right-rail',
            export: 'AskAiDialog',
          },
        },
      ],
    })
    expect(code).toContain('from "@bdocs/plugin-ask-ai/client"')
    expect(code).toContain('["AskAiDialog"]')
  })

  it('skips declaration when both modulePath and clientEntry are missing', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'broken',
          declaration: {
            id: 'floating-bottom',
            export: 'MyComp',
          },
        },
      ],
    })
    // Neither modulePath nor clientEntry → skipped, no import generated.
    expect(code).not.toContain('"floating-bottom"')
    expect(code).not.toContain('from')
  })

  it('export alias takes precedence over component when both are set', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'multi',
          declaration: {
            id: 'header-extra',
            modulePath: '@multi/client',
            component: 'OldName',
            export: 'NewName',
          },
        },
      ],
    })
    expect(code).toContain('["NewName"]')
    expect(code).not.toContain('["OldName"]')
  })

  it('emits slotConditions parallel map with null for unconditional slots', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            export: 'AskAiBubble',
          },
        },
      ],
    })
    expect(code).toContain('export const slotConditions')
    expect(code).toContain('null')
  })

  it('emits slotConditions with condition object when if is set', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'blog',
          declaration: {
            id: 'toc-extra',
            modulePath: '@blog/client',
            export: 'BlogToc',
            if: { collection: 'blog' },
          },
        },
      ],
    })
    expect(code).toContain('"collection"')
    expect(code).toContain('"blog"')
    expect(code).toContain('export const slotConditions')
  })

  it('conditions array length matches components array length', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'p1',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@p1/client',
            export: 'Badge',
            if: { locale: 'es' },
          },
        },
        {
          pluginName: 'p2',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@p2/client',
            export: 'Stat',
          },
        },
      ],
    })
    // Search for 'navbar-extra' inside the slotConditions section only,
    // because slotRegistry also contains 'navbar-extra' and its array is
    // smaller (matches first with non-greedy regex).
    const condSection = code.match(
      /export const slotConditions[\s\S]*?\}[\s\S]*?\}/,
    )
    expect(condSection).not.toBeNull()
    if (!condSection) return
    const navbarMatch = condSection[0].match(/"navbar-extra":\s*\[([\s\S]*?)\]/)
    expect(navbarMatch).not.toBeNull()
    if (!navbarMatch) return
    const content = navbarMatch[1]
    const nullCount = (content.match(/null/g) || []).length
    const objCount = (content.match(/\{/g) || []).length
    // 2 components → 2 condition entries (1 object + 1 null)
    expect(nullCount + objCount).toBe(2)
  })

  describe('matchesCondition', () => {
    const blogRoute = {
      path: '/docs/blog/hello',
      collection: 'blog',
      locale: 'en',
      tags: ['release', 'feature'],
    } as any

    it('returns true when condition is null (always render)', () => {
      expect(matchesCondition(null as any, blogRoute)).toBe(true)
    })

    it('returns true when route matches collection predicate', () => {
      expect(matchesCondition({ collection: 'blog' }, blogRoute)).toBe(true)
    })

    it('returns false when route does not match collection predicate', () => {
      expect(matchesCondition({ collection: 'guides' }, blogRoute)).toBe(false)
    })

    it('returns false when route is undefined (no context)', () => {
      expect(matchesCondition({ collection: 'blog' }, undefined)).toBe(false)
    })

    it('returns true when locale matches', () => {
      expect(matchesCondition({ locale: 'en' }, blogRoute)).toBe(true)
    })

    it('returns false when locale does not match', () => {
      expect(matchesCondition({ locale: 'es' }, blogRoute)).toBe(false)
    })

    it('matches tag via includes', () => {
      expect(matchesCondition({ tag: 'feature' }, blogRoute)).toBe(true)
      expect(matchesCondition({ tag: 'tutorial' }, blogRoute)).toBe(false)
    })

    it('matches path as regex pattern', () => {
      expect(matchesCondition({ path: '/docs/blog' }, blogRoute)).toBe(true)
      expect(matchesCondition({ path: '/docs/guides' }, blogRoute)).toBe(false)
    })

    it('AND logic: all predicates must match', () => {
      const condition = { collection: 'blog', locale: 'en' }
      expect(matchesCondition(condition, blogRoute)).toBe(true)

      const failCondition = { collection: 'blog', locale: 'es' }
      expect(matchesCondition(failCondition, blogRoute)).toBe(false)
    })

    it('returns true when condition is empty object (no predicates)', () => {
      expect(matchesCondition({}, blogRoute)).toBe(true)
    })

    it('returns false when route has no path but condition requires path', () => {
      const routeWithoutPath = { collection: 'blog' } as any
      expect(matchesCondition({ path: '/docs' }, routeWithoutPath)).toBe(false)
    })

    it('returns false when route has no tags but condition requires tag', () => {
      const routeWithoutTags = { collection: 'blog' } as any
      expect(matchesCondition({ tag: 'feature' }, routeWithoutTags)).toBe(false)
    })
  })

  // ── Phase 6: SSR flag tests ─────────────────────────────────

  it('emits slotSsrFlags parallel map with true for ssr:undefined slots', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ask-ai',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@bdocs/plugin-ask-ai/client',
            export: 'AskAiBubble',
          },
        },
      ],
    })
    expect(code).toContain('export const slotSsrFlags')
    // Default ssr is true
    expect(code).toContain('true')
  })

  it('emits false in slotSsrFlags when ssr is set to false', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'client-only',
          declaration: {
            id: 'right-rail',
            modulePath: '@client-only/client',
            export: 'ClientWidget',
            ssr: false,
          },
        },
      ],
    })
    expect(code).toContain('false')
    expect(code).toContain('export const slotSsrFlags')
  })

  it('slotSsrFlags array length matches components array length', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'ssr-on',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@ssr-on/client',
            export: 'SSRComp',
          },
        },
        {
          pluginName: 'ssr-off',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@ssr-off/client',
            export: 'ClientComp',
            ssr: false,
          },
        },
      ],
    })
    // Search for navbar-extra inside the slotSsrFlags section
    const ssrSection = code.match(/export const slotSsrFlags[\s\S]*?\}/)
    expect(ssrSection).not.toBeNull()
    if (!ssrSection) return
    const flagsMatch = ssrSection[0].match(/"navbar-extra":\s*\[([\s\S]*?)\]/)
    expect(flagsMatch).not.toBeNull()
    if (!flagsMatch) return
    const content = flagsMatch[1]
    const trueCount = (content.match(/true/g) || []).length
    const falseCount = (content.match(/false/g) || []).length
    // 2 components → 2 flags (1 true + 1 false)
    expect(trueCount + falseCount).toBe(2)
    expect(trueCount).toBe(1)
    expect(falseCount).toBe(1)
  })

  // ── Phase 7: Lazy flag tests ────────────────────────────────

  it('emits slotLazyFlags parallel map with false for lazy:undefined slots', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'test',
          declaration: {
            id: 'floating-bottom',
            modulePath: '@test/client',
            export: 'Normal',
          },
        },
      ],
    })
    expect(code).toContain('export const slotLazyFlags')
    expect(code).toContain('false')
  })

  it('emits true in slotLazyFlags when lazy is set to true', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'lazy',
          declaration: {
            id: 'right-rail',
            modulePath: '@lazy/client',
            export: 'LazyWidget',
            lazy: true,
          },
        },
      ],
    })
    expect(code).toContain('true')
    expect(code).toContain('export const slotLazyFlags')
  })

  it('slotLazyFlags array length matches components array length', () => {
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [
        {
          pluginName: 'normal',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@normal/client',
            export: 'Normal',
          },
        },
        {
          pluginName: 'lazy',
          declaration: {
            id: 'navbar-extra',
            modulePath: '@lazy/client',
            export: 'Lazy',
            lazy: true,
          },
        },
      ],
    })
    const lazySection = code.match(/export const slotLazyFlags[\s\S]*?\}/)
    expect(lazySection).not.toBeNull()
    if (!lazySection) return
    const flagsMatch = lazySection[0].match(/"navbar-extra":\s*\[([\s\S]*?)\]/)
    expect(flagsMatch).not.toBeNull()
    if (!flagsMatch) return
    const content = flagsMatch[1]
    const trueCount = (content.match(/true/g) || []).length
    const falseCount = (content.match(/false/g) || []).length
    // 2 components → 2 flags (1 true + 1 false)
    expect(trueCount + falseCount).toBe(2)
    expect(trueCount).toBe(1)
    expect(falseCount).toBe(1)
  })

  it('includes user-only slots for append (no plugin declaration → empty array)', () => {
    // append without prior component yields an empty slot array, which we
    // intentionally skip — append only makes sense when something exists.
    const code = generateLayoutSlotsCode({
      pluginDeclarations: [],
      userConfig: { 'navbar-extra': { append: '~/Badge.tsx' } },
    })
    expect(code).not.toContain(`"navbar-extra"`)
  })
})
