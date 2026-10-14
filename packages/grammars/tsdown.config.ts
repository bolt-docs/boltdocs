import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, packageConfig } from 'tsdown-config'

const banner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig([
  packageConfig({
    entry: {
      langs: 'src/langs.ts',
      themes: 'src/themes.ts',
    },
    format: ['esm'],
    dts: true,
    tsconfig: './tsconfig.json',
    // Grammars are data, not code. They are already `Object.freeze(JSON.parse(…))`,
    // so minifying them would only make the one-time parse slower to read from
    // disk for no byte saved.
    minify: false,
    platform: 'node',
    shims: false,
    clean: true,
    banner: { js: banner },
    deps: {
      skipNodeModulesBundle: true,
      // The grammars are copied verbatim by `onSuccess`, so the bundler must
      // NOT also emit a chunk per dynamic import. Without this it emits one
      // chunk for every `import('./grammars/x.mjs')` *and* the copy lands
      // beside it: two copies of 2.6 MB, which is how this package came to
      // weigh 5.9 MB instead of 2.9.
      neverBundle: [/^\.\/grammars\//, /^\.\/themes\//],
    },
    async onSuccess() {
      // The `.mjs` grammar files are imported dynamically by `LAZY_LANG_IMPORTS`,
      // so the bundler never emits them as chunks — they are copied verbatim.
      // Doing it here rather than bundling keeps one grammar in one file, which
      // is what makes a lazy `import()` of a single language possible.
      const copyDir = (src: string, dest: string) => {
        const from = path.resolve(__dirname, src)
        const to = path.resolve(__dirname, dest)
        if (!fs.existsSync(from)) return
        fs.mkdirSync(to, { recursive: true })
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          const source = path.join(from, entry.name)
          const target = path.join(to, entry.name)
          if (entry.isDirectory()) {
            fs.mkdirSync(target, { recursive: true })
            continue
          }
          fs.copyFileSync(source, target)
        }
      }

      copyDir('src/grammars', 'dist/grammars')
      copyDir('src/themes', 'dist/themes')

      const grammars = fs
        .readdirSync(path.resolve(__dirname, 'dist/grammars'))
        .filter((f) => f.endsWith('.mjs')).length
      const themes = fs
        .readdirSync(path.resolve(__dirname, 'dist/themes'))
        .filter((f) => f.endsWith('.mjs')).length
      console.log(
        `✓ ${grammars} grammar files and ${themes} theme files copied to dist`,
      )
    },
  }),
])
