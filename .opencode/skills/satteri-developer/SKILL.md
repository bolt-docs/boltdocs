---
name: satteri-developer
description: Comprehensive guide for developing with the Satteri Markdown/MDX processing library. Covers the full API, plugin system, AST manipulation, performance optimization, and internal architecture.
license: MIT
compatibility: opencode
metadata:
  author: Jesus Alcala
  version: "1.0"
  category: library-reference
  tags: markdown, mdx, rust, typescript, ast, plugins
---

## What I Am

I am a comprehensive reference for the Satteri library — a high-performance Markdown/MDX processor built with Rust + TypeScript. I provide the knowledge needed to use every feature of the library correctly and efficiently.

## When to Use Me

Use this skill when:
- Writing code that imports or uses the `satteri` npm package
- Creating MDAST or HAST plugins for markdown transformation
- Working with AST nodes, handles, readers, or materializers
- Debugging compilation or rendering issues
- Optimizing performance of markdown processing pipelines
- Understanding the binary AST format or arena allocation
- Implementing custom markdown extensions or MDX features

## What I Cover

| Topic | Reference File |
|-------|---------------|
| Full API surface (functions, options, handles) | `reference/API.md` |
| Plugin system (MDAST + HAST visitors) | `reference/PLUGINS.md` |
| All TypeScript type definitions | `reference/TYPES.md` |
| Utilities (Reader, CommandBuffer, OpWriter) | `reference/UTILS.md` |
| Concrete code examples | `reference/EXAMPLES.md` |
| Performance best practices | `reference/PERFORMANCE.md` |
| Internal architecture (arena, binary AST) | `reference/ARCHITECTURE.md` |

## Critical Rules

1. **NEVER create documentation files** to explain implementation. All docs already exist in the `website/` directory.
2. **NEVER add external dependencies** without justification. Use the standard library and existing utilities.
3. **Match existing code style** — naming conventions, file structure, and patterns must be consistent.
4. **All code, comments, and output must be in English.**
5. **Do not modify vendored `satteri-pulldown-cmark`** without explicit instruction — it intentionally diverges from upstream.
6. **Run `pnpm codegen`** after editing node types in `crates/satteri-layout-codegen/src/schema.rs`.

## Useful Commands

```sh
# Formatting
cargo fmt --all
pnpm format            # oxfmt + cargo fmt

# Linting
cargo clippy --all --all-targets
pnpm lint              # oxlint + cargo clippy

# Testing
cargo test --all
cd packages/satteri && pnpm test

# Building
cd packages/satteri && pnpm build

# Code generation (after editing schema.rs)
pnpm codegen
```

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/satteri/src/index.ts` | Public API surface |
| `packages/satteri/src/compile.ts` | `markdownToHtml`, `mdxToJs`, `evaluate` |
| `packages/satteri/src/plugin.ts` | `defineMdastPlugin`, `defineHastPlugin` |
| `packages/satteri/src/mdast/mdast-visitor.ts` | MDAST visitor context and walker |
| `packages/satteri/src/hast/hast-visitor.ts` | HAST visitor context and walker |
| `packages/satteri/src/types.ts` | Core type definitions |
| `packages/satteri/src/mdx-types.ts` | MDX AST node types |
| `crates/satteri-napi-binding/src/lib.rs` | NAPI binding layer |

## Pipeline Overview

```
Source (Markdown/MDX string)
  │
  ▼
Rust Parser (satteri-pulldown-cmark)
  │
  ▼
Arena<Mdast> ──────────────────────┐
  │                                │
  ▼                                │
MDAST Plugins (JS visitors)        │
  │                                │
  ▼                                │
Apply Commands to Arena            │
  │                                │
  ▼                                │
Convert MDAST → HAST ─────────────┤
  │                                │
  ▼                                │
HAST Plugins (JS visitors)         │
  │                                │
  ▼                                │
Render to HTML or Compile to JS    │
  │                                │
  ▼                                │
Result { html/code, frontmatter, data }
```

## How to Load References

Read the specific reference file based on your task:

- **Writing a plugin?** → Start with `reference/PLUGINS.md`, then `reference/EXAMPLES.md`
- **Using the compile API?** → Start with `reference/API.md`
- **Working with AST nodes?** → Start with `reference/TYPES.md`
- **Optimizing performance?** → Start with `reference/PERFORMANCE.md`
- **Low-level arena work?** → Start with `reference/UTILS.md` and `reference/ARCHITECTURE.md`
