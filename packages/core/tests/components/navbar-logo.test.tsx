import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import Navbar from '../../src/client/components/primitives/navbar'

const { Logo: NavbarLogo } = Navbar

/**
 * The logo must render identically on the server and in the browser.
 *
 * Picking the light or dark source from the resolved theme cannot work in a
 * server-rendered app: the server has no way to know it, the two sides pick
 * different files, and React discards the whole server HTML with hydration
 * error #418. Rendering both sources and letting CSS choose makes the markup
 * identical everywhere, which is the property these tests pin down.
 */

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: () => ({ base: '/docs' }),
}))

// The logo renders inside `Link`, which needs a router. The test is about the
// markup the logo emits, so the wrapper is replaced with a plain anchor.
vi.mock('../../src/client/components/primitives/link', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children?: React.ReactNode
    href?: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const render = (element: ReactElement) => renderToStaticMarkup(element)

describe('NavbarLogo', () => {
  it('renders both sources when a dark variant is configured', () => {
    const html = render(
      <NavbarLogo
        src="/logo-light.svg"
        srcLight="/logo-light.svg"
        srcDark="/logo-dark.svg"
        alt="Logo"
      />,
    )

    expect(html).toContain('/docs/logo-light.svg')
    expect(html).toContain('/docs/logo-dark.svg')
  })

  it('marks each variant so CSS can select it', () => {
    const html = render(
      <NavbarLogo
        src="/logo-light.svg"
        srcLight="/logo-light.svg"
        srcDark="/logo-dark.svg"
        alt="Logo"
      />,
    )

    expect(html).toContain('data-logo-theme="light"')
    expect(html).toContain('data-logo-theme="dark"')
  })

  it('hides the inactive variant with the dark variant rather than JavaScript', () => {
    const html = render(
      <NavbarLogo
        src="/logo-light.svg"
        srcLight="/logo-light.svg"
        srcDark="/logo-dark.svg"
        alt="Logo"
      />,
    )

    // The light logo is shown until `.dark` is on <html>; the dark one after.
    expect(html).toMatch(/data-logo-theme="light"[^>]*class="[^"]*dark:hidden/)
    expect(html).toMatch(
      /data-logo-theme="dark"[^>]*class="[^"]*hidden[^"]*dark:block/,
    )
  })

  it('renders a single image when there is no dark variant', () => {
    const html = render(<NavbarLogo src="/logo.svg" alt="Logo" />)

    expect(html.match(/<img/g)).toHaveLength(1)
    expect(html).toContain('/docs/logo.svg')
    expect(html).not.toContain('data-logo-theme')
  })

  it('renders a single image when both variants are the same file', () => {
    const html = render(
      <NavbarLogo
        src="/logo.svg"
        srcLight="/logo.svg"
        srcDark="/logo.svg"
        alt="Logo"
      />,
    )

    expect(html.match(/<img/g)).toHaveLength(1)
  })

  it('preloads only the light variant, since that is the first paint', () => {
    const html = render(
      <NavbarLogo
        src="/logo-light.svg"
        srcLight="/logo-light.svg"
        srcDark="/logo-dark.svg"
        alt="Logo"
      />,
    )

    // React emits a preload for every server-rendered image, `fetchPriority`
    // aside. What matters for hydration is that the set is derived from the
    // markup rather than from the theme, so both sides hoist the same links.
    // An earlier version resolved a single src from the theme: the server
    // preloaded one file, the client another, and React deleted the server's
    // preload before giving up on the tree.
    const preloads =
      html.match(/rel="preload" as="image" href="([^"]+)"/g) ?? []
    expect(preloads).toHaveLength(2)
    expect(html).toContain('as="image" href="/docs/logo-light.svg"')
    expect(html).toContain('as="image" href="/docs/logo-dark.svg"')
  })

  it('applies the configured base to both variants', () => {
    const html = render(
      <NavbarLogo
        src="/logo-light.svg"
        srcLight="/logo-light.svg"
        srcDark="/logo-dark.svg"
        alt="Logo"
      />,
    )

    // A site-root-relative path needs the base, or the browser gets a 404 while
    // the server-rendered markup still looks correct.
    expect(html).not.toMatch(/src="\/(?!docs)/)
  })

  it('leaves absolute URLs untouched', () => {
    const html = render(
      <NavbarLogo
        src="https://cdn.example.com/logo.svg"
        srcLight="https://cdn.example.com/logo.svg"
        srcDark="https://cdn.example.com/logo-dark.svg"
        alt="Logo"
      />,
    )

    expect(html).toContain('https://cdn.example.com/logo.svg')
    expect(html).toContain('https://cdn.example.com/logo-dark.svg')
  })

  it('renders nothing when there is no source', () => {
    const html = render(<NavbarLogo src="" alt="Logo" />)

    expect(html).not.toContain('<img')
  })
})
