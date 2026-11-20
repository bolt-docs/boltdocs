import { describe, expect, it } from 'vitest'
import { clientImportsTransform } from '../../src/node/migrate/transforms/client-imports'

const ctx = { root: '/project' }

function apply(source: string): string {
  return clientImportsTransform.apply?.(source, ctx) ?? source
}

describe('client-imports codemod', () => {
  it('splits a mixed import into the packages that own the names', () => {
    const source = [
      "import { DocsLayout, buildUrl } from 'boltdocs/client'",
      '',
    ].join('\n')

    const out = apply(source)

    expect(out).toContain("from '@bdocs/theme-neutral'")
    expect(out).toContain("from '@bdocs/runtime'")
    // The theme owns the layout; the runtime owns the URL contract.
    expect(out).toMatch(
      /import \{[^}]*DocsLayout[^}]*\} from '@bdocs\/theme-neutral'/,
    )
    expect(out).toMatch(/import \{[^}]*buildUrl[^}]*\} from '@bdocs\/runtime'/)
  })

  it('leaves a name the theme owns in the theme', () => {
    const out = apply("import { cn } from 'boltdocs/client'\n")
    expect(out).toBe("import { cn } from '@bdocs/theme-neutral'\n")
  })

  it('keeps a type-only import type-only', () => {
    const out = apply("import type { ComponentRoute } from 'boltdocs/client'\n")
    expect(out).toContain('import type {')
    expect(out).toContain("from '@bdocs/theme-neutral'")
  })

  it('keeps a per-name type modifier', () => {
    const out = apply(
      "import { type ComponentRoute, cn } from 'boltdocs/client'\n",
    )
    expect(out).toContain('type ComponentRoute')
  })

  it('rewrites the subpaths the engine used to publish', () => {
    expect(apply("import { Link } from 'boltdocs/primitives'\n")).toBe(
      "import { Link } from '@bdocs/theme-neutral/composition'\n",
    )
    expect(apply("import { Card } from 'boltdocs/mdx'\n")).toBe(
      "import { Card } from '@bdocs/theme-neutral'\n",
    )
    expect(apply("import { Outlet } from 'boltdocs/client/router'\n")).toBe(
      "import { Outlet } from '@bdocs/runtime/router'\n",
    )
  })

  it('rewrites several imports in one file without shifting the others', () => {
    // The bug this guards: a rewrite changes the length of the text, so
    // applying the rewrites in reading order lands the second one in the
    // middle of the first.
    const source = [
      "import { DocsLayout } from 'boltdocs/primitives'",
      "import { cn } from 'boltdocs/client'",
      "import { Card } from 'boltdocs/mdx'",
      '',
    ].join('\n')

    const out = apply(source)

    expect(out).toContain(
      "import { DocsLayout } from '@bdocs/theme-neutral/composition'",
    )
    expect(out).toContain("import { cn } from '@bdocs/theme-neutral'")
    expect(out).toContain("import { Card } from '@bdocs/theme-neutral'")
    expect(out).not.toContain('compositioncs')
  })

  it('reports a name neither package exports and leaves the import alone', () => {
    const source = "import { SomethingRemoved } from 'boltdocs/client'\n"
    const findings = clientImportsTransform.inspect('src.tsx', source, ctx)

    expect(findings.map((finding) => finding.id)).toEqual([
      'client/unknown-name',
    ])
    expect(findings[0].severity).toBe('blocking')
    expect(findings[0].action).toBe('manual')
    // A codemod that dropped a name it could not place would turn a compile
    // error into a runtime one.
    expect(apply(source)).toBe(source)
  })

  it('reports a namespace import rather than guessing', () => {
    const source = "import * as ui from 'boltdocs/client'\n"
    const findings = clientImportsTransform.inspect('src.tsx', source, ctx)

    expect(findings.map((finding) => finding.id)).toEqual(['client/namespace'])
    expect(findings[0].action).toBe('manual')
    expect(apply(source)).toBe(source)
  })

  it('reports the subpath rewrite as fixable', () => {
    const source = "import { Card } from 'boltdocs/mdx'\n"
    const findings = clientImportsTransform.inspect('src.tsx', source, ctx)

    expect(findings.map((finding) => finding.id)).toEqual(['client/subpath'])
    expect(findings[0].action).toBe('fixable')
  })

  it('moves the engine stylesheet to the theme', () => {
    // The engine used to publish the reset. The theme owns the look now, so
    // the stylesheet moved with it — and a site's own stylesheet has to follow.
    const source = '@import "boltdocs/theme/reset.css";\n'
    const findings = clientImportsTransform.inspect('index.css', source, ctx)

    expect(findings.map((finding) => finding.id)).toEqual(['client/subpath'])
    expect(findings[0].action).toBe('fixable')
    expect(apply(source)).toBe('@import "@bdocs/theme-neutral/reset";\n')
  })
})
