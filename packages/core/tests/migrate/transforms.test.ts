import { describe, expect, it } from 'vitest'
import { reactAriaTransform } from '../../src/node/migrate/transforms/react-aria'
import { themeSubpathTransform } from '../../src/node/migrate/transforms/theme-subpath'
import {
  seoPluginTransform,
  stripComments,
} from '../../src/node/migrate/transforms/seo-plugin'
import { packageJsonTransform } from '../../src/node/migrate/transforms/package-json'
import { findImports, findJsxAttributes } from '../../src/node/migrate/source'

const ctx = { root: '/project' }

describe('findImports', () => {
  it('finds static, dynamic and require specifiers with positions', () => {
    const source = [
      "import a from 'pkg-a'",
      'export { b } from "pkg-b"',
      "const c = await import('pkg-c')",
      "const d = require('pkg-d')",
    ].join('\n')

    const hits = findImports(source)

    expect(hits.map((h) => h.specifier)).toEqual([
      'pkg-a',
      'pkg-b',
      'pkg-c',
      'pkg-d',
    ])
    expect(hits[0].line).toBe(1)
    expect(hits[3].line).toBe(4)
    // Offsets must address the text inside the quotes, not the quote itself.
    expect(source.slice(hits[0].start, hits[0].end)).toBe('pkg-a')
  })

  it('does not treat a quoted " from " inside a string as an import', () => {
    const source = "const x = trimmed.indexOf(' from ')\n"
    expect(findImports(source)).toEqual([])
  })

  it('ignores imports inside line comments', () => {
    const source = ["// import a from 'pkg-a'", "import b from 'pkg-b'"].join(
      '\n',
    )
    expect(findImports(source).map((h) => h.specifier)).toEqual(['pkg-b'])
  })

  it('ignores imports inside block comments', () => {
    const source = [
      '/*',
      "import a from 'pkg-a'",
      '*/',
      "import b from 'pkg-b'",
    ].join('\n')
    expect(findImports(source).map((h) => h.specifier)).toEqual(['pkg-b'])
  })

  it('does not treat a URL in a string as a comment boundary', () => {
    const source = "const u = 'https://example.com'\nimport a from 'pkg-a'"
    expect(findImports(source).map((h) => h.specifier)).toEqual(['pkg-a'])
  })
})

describe('findJsxAttributes', () => {
  it('finds attributes and skips commented ones', () => {
    const source = ['<MenuItem onPress={x} />', '{/* onPress={y} */}'].join(
      '\n',
    )
    const hits = findJsxAttributes(source, 'onPress')
    expect(hits).toHaveLength(1)
    expect(hits[0].line).toBe(1)
  })
})

describe('reactAriaTransform', () => {
  it('reports the import once per occurrence', () => {
    const source = "import { Menu } from 'react-aria-components'"
    const findings = reactAriaTransform.inspect('a.tsx', source, ctx)

    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('react-aria/import')
    expect(findings[0].action).toBe('fixable')
    expect(findings[0].severity).toBe('blocking')
  })

  it('rewrites every occurrence of the specifier', () => {
    const source = [
      "import { Menu } from 'react-aria-components'",
      "import { Dialog } from 'react-aria-components'",
    ].join('\n')

    const out = reactAriaTransform.apply?.(source, ctx) ?? ''
    expect(out).toContain("from '@bdocs/primitives'")
    expect(out).not.toContain('react-aria-components')
    // Both lines must be rewritten: a back-to-front rewrite that mishandles
    // offsets would corrupt the first one.
    expect(out.split('\n')).toHaveLength(2)
    expect(out.split('\n').every((l) => l.includes('@bdocs/primitives'))).toBe(
      true,
    )
  })

  it('flags onPress as manual, never as an automatic rename', () => {
    const source = [
      "import { MenuItem } from 'react-aria-components'",
      '<MenuItem onPress={handle}>x</MenuItem>',
    ].join('\n')

    const findings = reactAriaTransform.inspect('a.tsx', source, ctx)
    const press = findings.filter((f) => f.id === 'react-aria/on-press')

    expect(press).toHaveLength(1)
    expect(press[0].action).toBe('manual')
    expect(press[0].severity).toBe('warning')
    expect(press[0].line).toBe(2)
  })

  it('flags SSRProvider as removed', () => {
    const source = [
      "import { SSRProvider } from 'react-aria-components'",
      '<SSRProvider><App /></SSRProvider>',
    ].join('\n')

    const findings = reactAriaTransform.inspect('a.tsx', source, ctx)
    expect(findings.some((f) => f.id === 'react-aria/ssr-provider')).toBe(true)
  })

  it('is silent for a file that never touched either package', () => {
    const source = "import { Menu } from './my-menu'"
    expect(reactAriaTransform.inspect('a.tsx', source, ctx)).toEqual([])
  })

  it('keeps reporting onPress after the import was rewritten', () => {
    // The property warning must survive `--apply`. If it only fired on files
    // still importing react-aria, applying the fix would silence the finding
    // that still needs a human, and the user would never see it again.
    const migrated = [
      "import { MenuItem } from '@bdocs/primitives'",
      '<MenuItem onPress={go}>Home</MenuItem>',
    ].join('\n')

    const findings = reactAriaTransform.inspect('a.tsx', migrated, ctx)
    expect(findings.map((f) => f.id)).toContain('react-aria/on-press')
    // And the import finding itself must not come back.
    expect(findings.map((f) => f.id)).not.toContain('react-aria/import')
  })

  it('leaves the source untouched when applying with no react-aria present', () => {
    const source = "import { Menu } from '@bdocs/primitives'"
    expect(reactAriaTransform.apply?.(source, ctx)).toBe(source)
  })
})

describe('themeSubpathTransform', () => {
  it('maps every removed alias onto its real entry point', () => {
    const cases: Array<[string, string]> = [
      [
        '@bdocs/theme-neutral/components/primitives',
        '@bdocs/theme-neutral/composition',
      ],
      ['@bdocs/theme-neutral/client', '@bdocs/theme-neutral'],
      ['@bdocs/theme-neutral/mdx', '@bdocs/theme-neutral'],
    ]

    for (const [from, to] of cases) {
      const source = `import { Navbar } from '${from}'`
      const out = themeSubpathTransform.apply?.(source, ctx) ?? ''
      expect(out).toContain(`'${to}'`)
      expect(
        themeSubpathTransform.inspect('a.tsx', source, ctx)[0]?.action,
      ).toBe('fixable')
    }
  })

  it('leaves already-valid entry points alone', () => {
    for (const spec of [
      '@bdocs/theme-neutral',
      '@bdocs/theme-neutral/composition',
      '@bdocs/theme-neutral/css',
    ]) {
      const source = `import x from '${spec}'`
      expect(themeSubpathTransform.inspect('a.tsx', source, ctx)).toEqual([])
      expect(themeSubpathTransform.apply?.(source, ctx)).toBe(source)
    }
  })
})

describe('stripComments', () => {
  it('removes comments but keeps string contents', () => {
    const source = "const a = 1 // gone\nconst b = 'https://x.com'"
    const out = stripComments(source)
    expect(out).toContain('https://x.com')
    expect(out).not.toContain('gone')
  })

  it('preserves offset alignment for retained characters', () => {
    const source = "/* c */ const a = 'x'"
    const stripped = stripComments(source)
    expect(stripped.length).toBeLessThan(source.length)
    expect(stripped.trimStart().startsWith('const')).toBe(true)
  })
})

describe('seoPluginTransform', () => {
  const config = [
    "import { defineConfig } from 'boltdocs'",
    '',
    'export default defineConfig({',
    "  siteUrl: 'https://example.com',",
    '  plugins: [',
    '    mermaidPlugin(),',
    '  ],',
    '})',
  ].join('\n')

  it('flags a site with SEO config and no plugin', () => {
    const findings = seoPluginTransform
      .inspect('boltdocs.config.ts', config, ctx)
      .filter((f) => f.id === 'seo/plugin-missing')
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('blocking')
    expect(findings[0].action).toBe('fixable')
  })

  it('flags a site with no search plugin', () => {
    // Search has no config key to key off, so this fires for every site
    // without the plugin — unlike SEO, which needs `siteUrl`/`robots`/`seo`.
    const findings = seoPluginTransform
      .inspect('boltdocs.config.ts', config, ctx)
      .filter((f) => f.id === 'search/plugin-missing')
    expect(findings).toHaveLength(1)
    expect(findings[0].action).toBe('fixable')
    // `warning`, not `blocking`: the site builds and renders every page, only
    // the search dialog is affected.
    expect(findings[0].severity).toBe('warning')
  })

  it('is silent about both once the plugins are imported', () => {
    const withBoth = config
      .replace(
        "import { defineConfig } from 'boltdocs'",
        [
          "import { defineConfig } from 'boltdocs'",
          "import seoPlugin from '@bdocs/plugin-seo'",
          "import searchPlugin from '@bdocs/plugin-search'",
        ].join('\n'),
      )
      .replace(
        '    mermaidPlugin(),',
        '    mermaidPlugin(),\n    seoPlugin(),\n    searchPlugin(),',
      )
    expect(
      seoPluginTransform.inspect('boltdocs.config.ts', withBoth, ctx),
    ).toEqual([])
  })

  it('adds both imports and both plugin calls', () => {
    const out = seoPluginTransform.apply?.(config, ctx) ?? ''
    expect(out).toContain("import seoPlugin from '@bdocs/plugin-seo'")
    expect(out).toContain("import searchPlugin from '@bdocs/plugin-search'")
    expect(out).toContain('seoPlugin()')
    expect(out).toContain('searchPlugin()')
    expect(out).toContain('mermaidPlugin()')
  })

  it('is silent about SEO when the SEO plugin is already imported', () => {
    const withPlugin = config.replace(
      "import { defineConfig } from 'boltdocs'",
      "import { defineConfig } from 'boltdocs'\nimport seoPlugin from '@bdocs/plugin-seo'",
    )
    expect(
      seoPluginTransform
        .inspect('boltdocs.config.ts', withPlugin, ctx)
        .filter((f) => f.id === 'seo/plugin-missing'),
    ).toEqual([])
  })

  it('adds the import and the plugin call', () => {
    const out = seoPluginTransform.apply?.(config, ctx) ?? ''
    expect(out).toContain("import seoPlugin from '@bdocs/plugin-seo'")
    expect(out).toContain('seoPlugin()')
    // The existing entry must survive.
    expect(out).toContain('mermaidPlugin()')
    // The import goes after the last existing import, not at the top of the file.
    const lines = out.split('\n')
    const defineLine = lines.findIndex((l) => l.includes("from 'boltdocs'"))
    const seoLine = lines.findIndex((l) => l.includes('@bdocs/plugin-seo'))
    expect(seoLine).toBe(defineLine + 1)
  })

  it('ignores a config that never configured SEO', () => {
    const bare = "export default defineConfig({ base: '/docs' })"
    expect(
      seoPluginTransform
        .inspect('boltdocs.config.ts', bare, ctx)
        .filter((f) => f.id === 'seo/plugin-missing'),
    ).toEqual([])
  })

  it('does not edit a plugins array it cannot resolve statically', () => {
    const dynamic = [
      "import { defineConfig } from 'boltdocs'",
      "import plugins from './plugins'",
      '',
      'export default defineConfig({',
      "  siteUrl: 'https://example.com',",
      '  plugins,',
      '})',
    ].join('\n')

    const findings = seoPluginTransform.inspect(
      'boltdocs.config.ts',
      dynamic,
      ctx,
    )
    expect(findings[0].action).toBe('manual')
    // apply must be a no-op here — appending would drop every plugin.
    expect(seoPluginTransform.apply?.(dynamic, ctx)).toBe(dynamic)
  })

  it.each([
    {
      name: 'one entry per line with a trailing comma',
      plugins: ['  plugins: [', '    mermaidPlugin(),', '  ],'].join('\n'),
      expected: [
        '  plugins: [',
        '    mermaidPlugin(),',
        '    seoPlugin(),',
        '    searchPlugin(),',
        '  ],',
      ].join('\n'),
    },
    {
      name: 'one entry per line without a trailing comma',
      plugins: ['  plugins: [', '    mermaidPlugin()', '  ]'].join('\n'),
      expected: [
        '  plugins: [',
        '    mermaidPlugin(),',
        '    seoPlugin(),',
        '    searchPlugin()',
        '  ]',
      ].join('\n'),
    },
    {
      name: 'an empty array',
      plugins: ['  plugins: [', '  ],'].join('\n'),
      expected: [
        '  plugins: [',
        '    seoPlugin(),',
        '    searchPlugin(),',
        '  ],',
      ].join('\n'),
    },
  ])('preserves the layout of $name', ({ plugins, expected }) => {
    const source = [
      "import { defineConfig } from 'boltdocs'",
      '',
      'export default defineConfig({',
      "  siteUrl: 'https://example.com',",
      plugins,
      '})',
    ].join('\n')

    const out = seoPluginTransform.apply?.(source, ctx) ?? ''
    // Only the plugins array should differ, plus the added import.
    expect(out).toContain(expected)
    // The result must parse. A codemod that emits a syntax error is worse than
    // one that does nothing, and the layout assertions above would not catch
    // a stray comma on a line of its own.
    expect(
      () =>
        new Function(
          out.replace(/^\s*import.*$/gm, '').replace(/export default/, ''),
        ),
    ).not.toThrow()
  })

  it('leaves a single-line plugins array alone rather than guessing', () => {
    const inline = [
      "import { defineConfig } from 'boltdocs'",
      '',
      'export default defineConfig({',
      "  siteUrl: 'https://example.com',",
      '  plugins: [mermaidPlugin()],',
      '})',
    ].join('\n')

    // Reformatting a one-liner into three lines is a bigger diff than the
    // migration warrants, and the array may be generated. Report, do not edit.
    expect(
      seoPluginTransform.inspect('boltdocs.config.ts', inline, ctx)[0].action,
    ).toBe('manual')
    expect(seoPluginTransform.apply?.(inline, ctx)).toBe(inline)
  })
})

describe('packageJsonTransform', () => {
  const withReactAria = JSON.stringify(
    {
      name: 'site',
      dependencies: { boltdocs: '^3.4.0', 'react-aria-components': '^1.16.0' },
    },
    null,
    2,
  )

  it('reports the stale react-aria entry and the primitives suggestion', () => {
    const findings = packageJsonTransform.inspect(
      'package.json',
      withReactAria,
      ctx,
    )
    const ids = findings.map((f) => f.id)
    expect(ids).toContain('deps/react-aria')
    expect(ids).toContain('deps/primitives')
  })

  it('removes react-aria and adds primitives in one edit', () => {
    const out = packageJsonTransform.apply?.(withReactAria, ctx) ?? ''
    const pkg = JSON.parse(out)
    expect(pkg.dependencies['react-aria-components']).toBeUndefined()
    expect(pkg.dependencies['@bdocs/primitives']).toBeDefined()
    expect(pkg.name).toBe('site')
  })

  it('does not add primitives when react-aria was never declared', () => {
    const bare = JSON.stringify(
      { name: 'site', dependencies: { boltdocs: '^4.0.0' } },
      null,
      2,
    )
    expect(packageJsonTransform.inspect('package.json', bare, ctx)).toEqual([])
    expect(packageJsonTransform.apply?.(bare, ctx)).toBe(bare)
  })

  it('leaves a manifest it cannot parse untouched', () => {
    const broken = '{ not json'
    expect(packageJsonTransform.inspect('package.json', broken, ctx)).toEqual(
      [],
    )
    expect(packageJsonTransform.apply?.(broken, ctx)).toBe(broken)
  })
})
