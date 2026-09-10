import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const docsDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(docsDir, '..', 'dist')
const baseDir = path.join(distDir, 'docs')

mkdirSync(baseDir, { recursive: true })

for (const entry of readdirSync(distDir, { withFileTypes: true })) {
  if (entry.name === 'docs' || entry.name.endsWith('.html')) continue

  const source = path.join(distDir, entry.name)
  const destination = path.join(baseDir, entry.name)

  rmSync(destination, { recursive: true, force: true })
  cpSync(source, destination, { recursive: true })
}

console.log('[docs] deployment assets mirrored under /docs')
