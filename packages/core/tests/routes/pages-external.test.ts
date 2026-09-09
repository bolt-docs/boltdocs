import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getExternalFileRoutes,
  getExternalRoutePaths,
} from '../../src/node/routes/pages-external'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('pages-external file routing', () => {
  it('discovers static tsx and mdx files only when enabled', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-external-'))
    temporaryDirectories.push(root)
    const externalDir = path.join(root, 'pages-external')
    fs.mkdirSync(externalDir, { recursive: true })
    fs.writeFileSync(
      path.join(externalDir, 'home.tsx'),
      'export default function Home() {}',
    )
    fs.writeFileSync(path.join(externalDir, 'about.mdx'), '# About')
    fs.writeFileSync(
      path.join(externalDir, '[id].tsx'),
      'export default function Dynamic() {}',
    )

    expect(getExternalFileRoutes(root, {})).toEqual([])
    expect(
      getExternalFileRoutes(root, { experimental: { fileRouting: true } }),
    ).toEqual([
      expect.objectContaining({ path: '/about', kind: 'mdx' }),
      expect.objectContaining({ path: '/home', kind: 'component' }),
    ])
  })

  it('keeps the legacy pages index and adds localized file routes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-external-'))
    temporaryDirectories.push(root)
    const externalDir = path.join(root, 'pages-external')
    fs.mkdirSync(externalDir, { recursive: true })
    fs.writeFileSync(
      path.join(externalDir, 'index.tsx'),
      "export const pages = { '/legacy': Legacy }",
    )
    fs.writeFileSync(
      path.join(externalDir, 'home.tsx'),
      'export default function Home() {}',
    )

    const paths = getExternalRoutePaths(root, {
      experimental: { fileRouting: true },
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })

    expect(paths).toEqual([
      '/legacy',
      '/en/legacy',
      '/es/legacy',
      '/home',
      '/en/home',
      '/es/home',
    ])
  })

  it('maps a configured locale directory to a localized route', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-external-'))
    temporaryDirectories.push(root)
    const externalDir = path.join(root, 'pages-external')
    fs.mkdirSync(path.join(externalDir, 'es'), { recursive: true })
    fs.writeFileSync(path.join(externalDir, 'roadmap.mdx'), '# Roadmap')
    fs.writeFileSync(
      path.join(externalDir, 'es', 'roadmap.mdx'),
      '# Hoja de ruta',
    )
    fs.writeFileSync(
      path.join(externalDir, 'es', 'index.tsx'),
      'export default function HomeEs() {}',
    )
    // `fr` is not a configured locale, so it stays a literal URL segment.
    fs.mkdirSync(path.join(externalDir, 'fr'), { recursive: true })
    fs.writeFileSync(path.join(externalDir, 'fr', 'start.mdx'), '# Démarrage')

    const routes = getExternalFileRoutes(root, {
      experimental: { fileRouting: true },
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })

    expect(routes).toEqual([
      expect.objectContaining({ path: '/es', locale: 'es', kind: 'component' }),
      expect.objectContaining({
        path: '/es/roadmap',
        locale: 'es',
        kind: 'mdx',
      }),
      expect.objectContaining({ path: '/fr/start', kind: 'mdx' }),
      expect.objectContaining({ path: '/roadmap', kind: 'mdx' }),
    ])
  })

  it('does not re-localize routes that already carry a locale', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-external-'))
    temporaryDirectories.push(root)
    const externalDir = path.join(root, 'pages-external')
    fs.mkdirSync(path.join(externalDir, 'es'), { recursive: true })
    fs.writeFileSync(path.join(externalDir, 'roadmap.mdx'), '# Roadmap')
    fs.writeFileSync(
      path.join(externalDir, 'es', 'roadmap.mdx'),
      '# Hoja de ruta',
    )

    const paths = getExternalRoutePaths(root, {
      experimental: { fileRouting: true },
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })

    expect([...paths].sort()).toEqual([
      '/en/roadmap',
      '/es/roadmap',
      '/roadmap',
    ])
  })
})
