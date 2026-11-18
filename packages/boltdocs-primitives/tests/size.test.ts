import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(process.cwd(), 'src')
const DIST = resolve(process.cwd(), 'dist/index.mjs')

/** Classes that only mean anything when Tailwind is installed. */
const UTILITY =
  /\b(?:flex|inline-flex|inline-block|absolute|relative|fixed|inset-0|z-\d+|overflow-auto|outline-none|select-none|whitespace-nowrap|opacity-\d+|w-full|sr-only|cursor-default|border-t|flex-row|flex-col|items-center|justify-center|group)\b/

describe('primitives stay style-neutral and small', () => {
  it('ships no Tailwind utility classes in its source', () => {
    const offenders: Record<string, string> = {}
    const stack = [SRC]
    while (stack.length > 0) {
      const dir = stack.pop() as string
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          stack.push(path)
        } else if (/\.tsx?$/.test(entry.name)) {
          readFileSync(path, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            .split('\n')
            .forEach((line, index) => {
              // Only class-name contexts count: an inline `position: absolute`
              // or a `role="group"` is not a Tailwind utility.
              if (!/className|cn\(/.test(line)) return
              if (UTILITY.test(line)) {
                offenders[path] = `${index + 1}: ${line.trim()}`
              }
            })
        }
      }
    }
    expect(offenders).toEqual({})
  })

  it('keeps the ESM bundle under its gzip budget', () => {
    // Tests can run before a build; skip then rather than failing for a missing
    // artifact. CI runs build before this suite.
    if (!existsSync(DIST)) return
    const bytes = gzipSync(readFileSync(DIST)).length
    expect(bytes).toBeLessThan(11_000)
  })
})
