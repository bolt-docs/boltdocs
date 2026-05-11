import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNavbar } from '../../src/client/hooks/use-navbar'
import { useConfig } from '../../src/client/app/config-context'
import { useTheme } from '../../src/client/app/theme-context'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useLocation } from 'react-router-dom'

vi.mock('../../src/client/app/config-context')
vi.mock('../../src/client/app/theme-context')
vi.mock('../../src/client/hooks/use-routes')
vi.mock('react-router-dom')

describe('useNavbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useTheme as any).mockReturnValue({ theme: 'light', resolvedTheme: 'light' })
    ;(useRoutes as any).mockReturnValue({ currentLocale: 'en' })
    ;(useLocation as any).mockReturnValue({ pathname: '/' })
  })

  it('should map simple links with label translation', () => {
    ;(useConfig as any).mockReturnValue({
      theme: {
        navbar: [
          { label: { en: 'Home', es: 'Inicio' }, href: '/' }
        ]
      }
    })

    const { links } = useNavbar()
    expect(links).toHaveLength(1)
    expect(links[0].label).toBe('Home')
    expect(links[0].href).toBe('/')
    expect(links[0].active).toBe(true)
  })

  it('should mark external links correctly', () => {
    ;(useConfig as any).mockReturnValue({
      theme: {
        navbar: [
          { label: 'GitHub', href: 'https://github.com/test' }
        ]
      }
    })

    const { links } = useNavbar()
    expect(links).toHaveLength(1)
    expect(links[0].to).toBe('external')
  })

  it('should handle current locale for translations', () => {
    ;(useRoutes as any).mockReturnValue({ currentLocale: 'es' })
    ;(useConfig as any).mockReturnValue({
      theme: {
        navbar: [
          { label: { en: 'Home', es: 'Inicio' }, href: '/' }
        ]
      }
    })

    const { links } = useNavbar()
    expect(links[0].label).toBe('Inicio')
  })

  it('should use default title when not configured', () => {
    ;(useConfig as any).mockReturnValue({ theme: {} })

    const { title } = useNavbar()
    expect(title).toBe('Boltdocs')
  })

  it('should set active for matching pathname', () => {
    ;(useLocation as any).mockReturnValue({ pathname: '/docs' })
    ;(useConfig as any).mockReturnValue({
      theme: {
        navbar: [
          { label: 'Docs', href: '/docs' },
          { label: 'Guide', href: '/guide' }
        ]
      }
    })

    const { links } = useNavbar()
    expect(links[0].active).toBe(true)
    expect(links[1].active).toBe(false)
  })
})