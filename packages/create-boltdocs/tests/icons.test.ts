import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateIconsFile, getIconLibraryVersion } from '../src/utils/icons'
import type { IconLibrary } from '../src/cli'

const libraries: IconLibrary[] = [
  'lucide-react',
  '@heroicons/react',
  '@phosphor-icons/react',
]

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('custom icon generation', () => {
  it.each(
    libraries,
  )('generates named and default exports for %s', (library) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-icons-'))
    tempDirs.push(projectDir)

    generateIconsFile(projectDir, library)

    const content = fs.readFileSync(
      path.join(projectDir, 'docs/icons.tsx'),
      'utf8',
    )
    expect(content).toContain(
      `from '${library === '@heroicons/react' ? '@heroicons/react/24/outline' : library}'`,
    )
    expect(content).toContain('export { Route, FileText')
    expect(content).toContain('export default icons')
    expect(getIconLibraryVersion(library)).toMatch(/^\^\d+/)
  })
})
