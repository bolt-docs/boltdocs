import { describe, it, expect } from 'vitest'
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
