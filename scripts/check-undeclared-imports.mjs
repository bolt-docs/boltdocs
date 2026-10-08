/**
 * Undeclared-import audit, run over every workspace package.
 *
 * The failure this finds is the quietest one in a monorepo. A package imports
 * something it never declared; pnpm's strict `node_modules` says the import
 * cannot resolve — but only for the package that owns the file, and only in the
 * consumer that happens not to have it hoisted. Inside the workspace the
 * importing package is usually installed next to a package that *does* declare
 * it, so the build stays green until someone installs the package on its own.
 *
 * That is not hypothetical here. `@bdocs/theme-neutral` imported `flexsearch`,
 * `clsx`, `tailwind-merge`, `dompurify`, `react-helmet-async` and
 * `scroll-into-view-if-needed`, declared none of them, and built fine for
 * months — the first build in an environment that did not hoist them failed with
 * "Rolldown failed to resolve import flexsearch", in a file three packages away
 * from the cause. `@bdocs/processor-satteri` imported `boltdocs/node/cache` and
 * `boltdocs/node/highlight` with no `boltdocs` dependency at all, behind a
 * dynamic `import()`, so nothing failed at build time and everything failed at
 * run time.
 *
 * A dynamic import hides the failure but does not excuse it: it is the same
 * missing dependency, only one that survives to runtime. Both are reported.
 *
 * ── Why a scanner and not a regex ───────────────────────────────────────────
 *
 * The first version of this file matched `\bfrom\s+['"]…` with a regular
 * expression and reported eleven findings in `@bdocs/processor-satteri`, of
 * which three were real. The rest were the inside of `trimmed.indexOf(' from ')`
 * — the quote after `from ` is a *string delimiter*, not the opening quote of a
 * module specifier, and a regex cannot tell the two apart. A tool that reports
 * false positives gets ignored, and an audit that gets ignored protects nothing.
 *
 * So this uses TypeScript's own scanner, which already tracks string and
 * template literals correctly. It is also why `virtual:` is filtered by hand
 * rather than by pattern: the scanner is right about what the file says, and
 * `virtual:boltdocs-*` is a module the framework's Vite plugin resolves, not a
 * package.
 *
 * ── What is deliberately not reported ───────────────────────────────────────
 *
 *   virtual:boltdocs-*      Resolved by the Vite plugin, not by a package
 *   node: builtins          Runtime-provided
 *   `@types/x` for `x`      The TypeScript convention for a type-only import is
 *                           a `@types/` devDependency; requiring the bare name in
 *                           `dependencies` would fight the ecosystem.
 *
 * Usage:
 *   node scripts/check-undeclared-imports.mjs            # report, exit 1 on any
 *   node scripts/check-undeclared-imports.mjs --json     # machine-readable
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')

/** Resolved from the workspace rather than imported, so the script has no deps. */
function loadTypeScript() {
  const candidates = readdirSync(join(ROOT, 'node_modules/.pnpm'))
    .filter((d) => d.startsWith('typescript@'))
    .sort()
  for (const dir of candidates) {
    const entry = join(
      ROOT,
      'node_modules/.pnpm',
      dir,
      'node_modules/typescript',
    )
    if (existsSync(entry)) return createRequire(join(entry, 'index.js'))(entry)
  }
  throw new Error(
    'typescript not found in the workspace; run `pnpm install` before this script',
  )
}

const BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'dgram',
  'dns',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
])

/** Bare specifiers a file imports, via TypeScript's own scanner. */
function imports(ts, file) {
  const code = readFileSync(file, 'utf8')
  const { importedFiles, referencedFiles } = ts.preProcessFile(code, true, true)
  return [...importedFiles, ...referencedFiles]
    .map((i) => i.fileName)
    .filter(
      (spec) =>
        !spec.startsWith('.') &&
        // Framework-resolved modules.
        !spec.startsWith('virtual:') &&
        // Path aliases are resolved by the package's own build config.
        !spec.startsWith('@/'),
    )
}

/**
 * The package name a specifier resolves to.
 *
 * Scoped names keep two segments (`@scope/name/sub/path` is the package
 * `@scope/name`); unscoped ones keep one.
 */
function packageName(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * Specifiers that are resolved on purpose rather than declared.
 *
 * Each entry is a package a consumer may or may not have installed, loaded
 * through `createRequire` from the *project root* rather than from this
 * package. Declaring it would defeat the point: the whole reason to reach for
 * it dynamically is that it must stay optional. `imageOptimizer` is off unless
 * `experimental.imageOptimizer` is set, and the code says so in a warning when
 * the package is missing.
 *
 * An empty entry is not an option here either — a name with no reason is
 * indistinguishable from a leftover, which is the same trap the theme's style
 * guard sets for its own exceptions.
 */
const OPTIONAL_BY_DESIGN = new Map([
  [
    '@bdocs/plugin-image-optimizer',
    'Resolved from the user project with createRequire, behind\n' +
      ' `experimental.imageOptimizer`. Declaring it as a dependency would make a\n' +
      '  ~10 MB native image toolchain part of every install, which is the opposite\n' +
      '  of the opt-in it exists to be. Missing it is a warning, not an error.',
  ],
])

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo')
      continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (
      /\.(ts|tsx|mts|cts)$/.test(entry) &&
      !entry.endsWith('.d.ts') &&
      // Fixtures and tests are inputs, not code the package ships.
      !/\.(test|spec)\.(ts|tsx)$/.test(entry)
    )
      out.push(full)
  }
  return out
}

const ts = loadTypeScript()
const findings = []

for (const dir of readdirSync(PACKAGES)) {
  const pkgDir = join(PACKAGES, dir)
  if (!statSync(pkgDir).isDirectory()) continue
  const manifestPath = join(pkgDir, 'package.json')
  if (!existsSync(manifestPath)) continue

  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const dev = Object.keys(pkg.devDependencies ?? {})
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    // `@types/hast` in devDependencies is how you declare `import … from 'hast'`.
    ...dev.map((d) => d.replace(/^@types\//, '')),
  ])
  // Self-references are declared by definition.
  declared.add(pkg.name)

  for (const file of walk(join(pkgDir, 'src'))) {
    for (const spec of imports(ts, file)) {
      const name = packageName(spec)
      if (spec.startsWith('node:') || BUILTINS.has(name)) continue
      if (declared.has(name)) continue
      if (OPTIONAL_BY_DESIGN.has(name)) continue
      findings.push({
        package: pkg.name,
        file: relative(ROOT, file).replaceAll('\\', '/'),
        specifier: spec,
      })
    }
  }
}

/**
 * Allowlist entries that stopped being necessary.
 *
 * An exception outlives the thing it excused, and then it is a hole: the next
 * person to import that package for an unrelated reason is not reported. This
 * is the one check that makes the allowlist safe to keep.
 */
const staleExceptions = []
for (const name of OPTIONAL_BY_DESIGN.keys()) {
  for (const dir of readdirSync(PACKAGES)) {
    const manifestPath = join(PACKAGES, dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (pkg.name === name) continue // the package itself
    const declaredNow =
      pkg.name === name ||
      (pkg.dependencies ?? {})[name] ||
      (pkg.peerDependencies ?? {})[name]
    if (declaredNow) staleExceptions.push(`${pkg.name} now declares ${name}`)
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings, staleExceptions }, null, 2))
} else if (findings.length === 0 && staleExceptions.length === 0) {
  console.log('✓ every bare import is declared by the package that makes it')
  if (OPTIONAL_BY_DESIGN.size > 0) {
    console.log(
      `  (${OPTIONAL_BY_DESIGN.size} resolved on purpose: ${[...OPTIONAL_BY_DESIGN.keys()].join(', ')})`,
    )
  }
} else {
  if (findings.length > 0) {
    const byPackage = new Map()
    for (const f of findings) {
      if (!byPackage.has(f.package)) byPackage.set(f.package, [])
      byPackage.get(f.package).push(f)
    }
    for (const [name, list] of byPackage) {
      console.log(`\n✗ ${name} — ${list.length} sin declarar`)
      for (const f of list) console.log(`    ${f.specifier}  ←  ${f.file}`)
    }
    console.log(
      `\n${findings.length} sin declarar en ${byPackage.size} paquetes`,
    )
  }
  for (const line of staleExceptions)
    console.log(`\n✗ excepción obsoleta: ${line}`)
}

process.exit(findings.length === 0 && staleExceptions.length === 0 ? 0 : 1)
