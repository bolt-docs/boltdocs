# `create-boltdocs`

Scaffold a new Boltdocs site. This is the package behind
`pnpm create boltdocs` / `npx create-boltdocs`.

## Use

```bash
pnpm create boltdocs
```

The CLI asks for a project name and a preset, then copies the template,
generates the icon registry and optionally installs dependencies. Non-interactive
runs can pass everything as flags:

```bash
pnpm create boltdocs my-docs --template base --deploy vercel \
  --icon-library lucide-react
```

| Flag | Values | Purpose |
| --- | --- | --- |
| `--template`, `-t` | `base`, `i18n`, `blog` | Hero landing, EN/ES site, or docs + blog collection |
| `--deploy`, `-d` | `vercel`, `netlify`, `cloudflare`, `aws`, `static` | Wires the matching feedback adapter |
| `--icon-library`, `-l` | `lucide-react`, `@heroicons/react`, `@phosphor-icons/react` | Generates `icons.tsx` |

`base` is the default preset. Dependencies are installed with the package
manager detected from the environment (pnpm is preferred).

## What you get

A ready-to-run project with `boltdocs.config.ts`, `package.json`, TypeScript
configs, `index.html`, a theme CSS entry and a starter docs tree. The `i18n`
preset adds EN/ES routing; `blog` adds a dated collection with feeds.

## Notes

This is a developer scaffolder, not a runtime dependency. Generated sites
depend on `boltdocs` and `@bdocs/theme-neutral`; `create-boltdocs` itself is
only used once, at project creation time.
