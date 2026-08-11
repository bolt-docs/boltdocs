# CLI Reference

Boltdocs provides a comprehensive CLI (`boltdocs`) for development, building, previewing, and maintaining your documentation site.

## Commands

### `boltdocs dev [root]`

Start the development server with HMR support.

```bash
boltdocs dev                         # Start dev server (default root: cwd)
boltdocs dev --port 3000             # Custom port
boltdocs dev --host                  # Listen on all network interfaces
boltdocs dev --host 0.0.0.0         # Specific host
boltdocs dev --force                 # Force Vite to re-optimize dependencies
```

- HMR for MDX content changes (no full reload for body-only edits)
- Prewarming: first 20 routes pre-transformed in batches for faster initial navigation
- Link tree generation runs in the background
- Plugin lifecycle hooks run at startup (`dev:before`, `dev:after`)
- Config file changes trigger automatic server restart

---

### `boltdocs build [root]`

Build the documentation site for production.

```bash
boltdocs build                       # Build for production (default root: cwd)
BOLTDOCS_BENCHMARK_PHASES=true boltdocs build   # Benchmark mode
```

The build pipeline executes these steps in order:

1. **ConfigResolve** — Resolve `boltdocs.config.ts`, generate routes and types
2. **RouteGenerate** — Generate all documentation routes with metadata
3. **SEOValidate** + **TypeGenerate** — Validate SEO metadata, generate project types (parallel)
4. **SSGBuild** — Two Vite builds:
   - Client build (production bundle with manifest)
   - Server build (SSR bundle for static HTML rendering)
5. **SEOWrite** — Write sitemap.xml, robots.txt, and run `build:generate` hooks

---

### `boltdocs preview [root]`

Preview the production build locally.

```bash
boltdocs preview                     # Preview dist/ (default port: 4173)
boltdocs preview --port 5000        # Custom port
boltdocs preview --host              # Listen on all interfaces
```

---

### `boltdocs doctor [root]`

Check the health of your documentation site. Validates internal links, structure, and configuration.

```bash
boltdocs doctor                      # Run health check
boltdocs doctor --fix               # Auto-fix broken internal links and sync translations
boltdocs doctor --check-external    # Also verify external links (slower)
boltdocs doctor --init               # Initialize doctor.json with default config
boltdocs doctor --budget            # Check build performance against configured budgets
```

---

### `boltdocs audit [root]`

Statically scans every configured plugin's source for security-sensitive behavior — child-process and dynamic-code calls, network access, file reads/writes, environment-variable reads, and metadata red flags (install scripts, bundled deps, missing license/provenance). The scan never executes plugin code.

```bash
boltdocs audit                       # Security audit of plugins
```

**Exit codes (CI contract):**

| Code | Meaning |
| ------ | --------- |
| `0` | Every plugin was scanned and has no high-risk findings (low/warning findings alone still pass) |
| `1` | At least one plugin has HIGH-risk findings, is unresolved, failed to scan, or the scan was truncated |

The command is fail-closed: unresolved or un-scanned plugins never count as passing. Use it as a CI gate before merging third-party plugins:

```bash
pnpm docs:audit || exit 1
```

---

### `boltdocs generate-changelog <file>`

Generate changelog documentation pages from a `CHANGELOG.md` file.

```bash
boltdocs generate-changelog CHANGELOG.md -o docs/changelog -t "Changelog" -l 10
```

Options:

| Flag | Default | Description |
| ------ | --------- | ------------- |
| `-o, --output` | `docs/changelog` | Output folder |
| `-t, --title` | `Changelog` | Title for changelog pages |
| `-l, --limit` | — | Limit number of versions to generate |
| `--infer-tab` | `true` | Infer tab from folder name |

---

## Environment Variables

| Variable | Description |
| ---------- | ------------- |
| `BOLTDOCS_CACHE_DIR` | Custom cache directory (default: `.boltdocs/`) |
| `BOLTDOCS_NO_CACHE` | Disable caching |
| `BOLTDOCS_CACHE_COMPRESS` | Enable gzip compression for cache |
| `BOLTDOCS_BENCHMARK_PHASES` | Enable per-phase benchmarking in builds |
| `VITE_SSG` | Set automatically during SSR builds (plugins use to check build mode) |
| `NODE_ENV` | Set to `production` during SSG builds |
