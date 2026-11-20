/**
 * Docusaurus sidebar → Boltdocs navigation migration.
 *
 * Docusaurus describes navigation in JS. This is a deliberately small literal
 * parser (not a JS parser): sidebars are data — strings, numbers, arrays and
 * plain objects — and anything it cannot read becomes a `manual` finding
 * rather than a guess. The parser runs on a comment-blanked copy of the source
 * so a commented-out sidebar entry can never be applied.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding } from './types'
import {
  defaultExportObject,
  exists,
  finding,
  getFrontmatterScalar,
  objectAfterAssignment,
  objectLiteralAfter,
  parseFrontmatter,
  readJsonRecord,
  readText,
  replaceFrontmatterField,
  serializeFrontmatter,
  stripComments,
  walkFiles,
  writeText,
  type JsonRecord,
} from './framework-common'

export interface UnknownValue {
  readonly __unknown: true
}
export const UNKNOWN: UnknownValue = { __unknown: true }

export type JValue =
  | string
  | number
  | boolean
  | null
  | JValue[]
  | JObject
  | UnknownValue

export interface JObject {
  [key: string]: JValue
}

export function isJObject(value: JValue): value is JObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !('__unknown' in value)
  )
}

function asString(value: JValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: JValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asArray(value: JValue | undefined): JValue[] {
  return Array.isArray(value) ? value : []
}

export class LiteralParser {
  private i = 0
  private readonly src: string

  constructor(source: string) {
    this.src = stripComments(source)
  }

  parse(): JValue {
    const value = this.value()
    return value
  }

  private ws(): void {
    while (/\s/.test(this.src[this.i] ?? '')) this.i++
  }

  private value(): JValue {
    this.ws()
    const ch = this.src[this.i]
    if (ch === undefined) return UNKNOWN
    if (ch === '{') return this.object()
    if (ch === '[') return this.array()
    if (ch === '"' || ch === "'" || ch === '`') return this.string()
    if (ch === '-' || /^\d$/.test(ch)) return this.number()
    if (this.src.startsWith('...', this.i)) {
      this.skipToDelimiter()
      return UNKNOWN
    }
    if (ch === '(') {
      this.skipBalanced('(', ')')
      return UNKNOWN
    }
    const ident = /^[A-Za-z_$][\w$-]*/.exec(this.src.slice(this.i))
    if (ident) {
      this.i += ident[0].length
      if (this.src[this.i] === '(') {
        this.skipBalanced('(', ')')
        return UNKNOWN
      }
      if (ident[0] === 'true') return true
      if (ident[0] === 'false') return false
      if (ident[0] === 'null') return null
      // Bare identifiers are Docusaurus doc-id shorthand.
      return ident[0]
    }
    this.i++
    return UNKNOWN
  }

  private string(): string {
    const quote = this.src[this.i++]
    let out = ''
    while (this.i < this.src.length) {
      const ch = this.src[this.i++]
      if (ch === '\\') {
        const escaped = this.src[this.i++]
        if (escaped === 'n') out += '\n'
        else if (escaped === 'r') out += '\r'
        else if (escaped === 't') out += '\t'
        else out += escaped ?? ''
        continue
      }
      if (ch === quote) break
      out += ch
    }
    return out
  }

  private number(): number {
    const m = /^-?\d+(?:\.\d+)?/.exec(this.src.slice(this.i))
    if (!m) {
      this.i++
      return Number.NaN
    }
    this.i += m[0].length
    return Number(m[0])
  }

  private object(): JObject {
    const out: JObject = {}
    this.i++ // {
    while (this.i < this.src.length) {
      this.ws()
      if (this.src[this.i] === '}') {
        this.i++
        break
      }
      if (this.src.startsWith('...', this.i)) {
        this.skipToDelimiter()
        this.comma()
        continue
      }
      const key = this.key()
      this.ws()
      if (this.src[this.i] !== ':') {
        this.skipToDelimiter()
        this.comma()
        continue
      }
      this.i++
      out[key] = this.value()
      this.comma()
    }
    return out
  }

  private array(): JValue[] {
    const out: JValue[] = []
    this.i++ // [
    while (this.i < this.src.length) {
      this.ws()
      if (this.src[this.i] === ']') {
        this.i++
        break
      }
      if (this.src.startsWith('...', this.i)) {
        this.skipToDelimiter()
        out.push(UNKNOWN)
        this.comma()
        continue
      }
      out.push(this.value())
      this.comma()
    }
    return out
  }

  private key(): string {
    const ch = this.src[this.i]
    if (ch === '"' || ch === "'" || ch === '`') return this.string()
    const ident = /^[A-Za-z_$][\w$-]*/.exec(this.src.slice(this.i))
    if (ident) {
      this.i += ident[0].length
      return ident[0]
    }
    this.i++
    return ''
  }

  private comma(): void {
    this.ws()
    if (this.src[this.i] === ',') this.i++
  }

  private skipToDelimiter(): void {
    while (
      this.i < this.src.length &&
      ![',', '}', ']'].includes(this.src[this.i])
    ) {
      this.i++
    }
  }

  private skipBalanced(open: string, close: string): void {
    let depth = 0
    while (this.i < this.src.length) {
      const ch = this.src[this.i++]
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) break
      }
    }
  }
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface DocRef {
  id: string
  file: string
}

function collectDocs(root: string, docsDir: string): DocRef[] {
  const sourceDir = path.join(root, docsDir)
  const out: DocRef[] = []
  for (const file of walkFiles(sourceDir, new Set(['.md', '.mdx']))) {
    const source = readText(file)
    if (source == null) continue
    const parsed = parseFrontmatter(source)
    const id =
      (parsed ? getFrontmatterScalar(parsed.raw, 'id') : null) ??
      path
        .relative(sourceDir, file)
        .replace(/\\/g, '/')
        .replace(/\.(md|mdx)$/, '')
    out.push({ id, file })
  }
  return out
}

interface MetaValue {
  title?: string
  order?: number
  collapsible?: boolean
  collapsed?: boolean
  [key: string]: string | number | boolean | undefined
}

export type SidebarAction =
  | { kind: 'move'; from: string; to: string; id: string }
  | { kind: 'meta'; dir: string; meta: MetaValue }
  | { kind: 'frontmatter'; file: string; position?: number; label?: string }

export interface SidebarPlan {
  actions: SidebarAction[]
  findings: MigrationFinding[]
}

/** Narrow a parsed meta.json to the fields Boltdocs understands. */
function parseMeta(value: JsonRecord | null): MetaValue {
  if (!value) return {}
  const meta: MetaValue = {}
  if (typeof value.title === 'string') meta.title = value.title
  if (typeof value.order === 'number') meta.order = value.order
  if (typeof value.collapsible === 'boolean')
    meta.collapsible = value.collapsible
  if (typeof value.collapsed === 'boolean') meta.collapsed = value.collapsed
  return meta
}

function readMeta(dir: string): MetaValue | null {
  return parseMeta(readJsonRecord(path.join(dir, 'meta.json')))
}

function addMeta(
  actions: Map<string, MetaValue>,
  dir: string,
  next: MetaValue,
): void {
  const current = actions.get(dir) ?? readMeta(dir) ?? {}
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) current[key] = value
  }
  actions.set(dir, current)
}

function planSidebars(
  root: string,
  docsDir: string,
  source: string,
): SidebarPlan {
  const findings: MigrationFinding[] = []
  const actions: SidebarAction[] = []
  const metaActions = new Map<string, MetaValue>()
  const docs = collectDocs(root, docsDir)
  const handled = new Set<string>()

  const literal =
    objectAfterAssignment(source, 'sidebars') ??
    objectLiteralAfter(source, 'sidebars') ??
    objectAfterAssignment(source, 'module.exports') ??
    defaultExportObject(source) ??
    objectLiteralAfter(source, 'themeConfig')

  const parsed = literal ? new LiteralParser(literal).parse() : UNKNOWN
  if (!isJObject(parsed)) {
    findings.push(
      finding({
        id: 'docusaurus/sidebars-unparsed',
        severity: 'warning',
        action: 'manual',
        title: 'Sidebar config could not be parsed — migrate manually',
        detail:
          'The sidebar definition uses expressions this migrator cannot read. Boltdocs derives navigation from filesystem structure, frontmatter and meta.json.',
        file: 'sidebars.js',
      }),
    )
    return { actions, findings }
  }

  const manual = (id: string, title: string, detail: string) =>
    findings.push(
      finding({
        id,
        severity: 'warning',
        action: 'manual',
        title,
        detail,
        file: 'sidebars.js',
      }),
    )

  const handleDoc = (
    id: string,
    parentDir: string,
    opts: { label?: string; position?: number },
  ) => {
    if (handled.has(id)) {
      manual(
        'docusaurus/sidebars-duplicate',
        `Doc '${id}' is referenced by more than one sidebar entry`,
        'Boltdocs renders one navigation tree. Decide which sidebar should own this page.',
      )
      return
    }
    const ref = docs.find((d) => d.id === id)
    if (!ref) {
      manual(
        'docusaurus/sidebars-missing-doc',
        `Sidebar references unknown doc '${id}'`,
        'No Markdown file with this id was found under docs/. Create it or remove the sidebar entry.',
      )
      return
    }
    handled.add(id)

    const to = path.join(parentDir, `${path.basename(ref.file)}`)
    if (path.resolve(to) !== path.resolve(ref.file)) {
      if (exists(to)) {
        manual(
          'docusaurus/sidebars-conflict',
          `Cannot move '${id}' — target already exists`,
          `Both ${path.relative(root, ref.file)} and ${path.relative(root, to)} exist. Resolve the filename conflict before migrating.`,
        )
      } else {
        actions.push({ kind: 'move', from: ref.file, to, id })
        ref.file = to
      }
    }

    const source = readText(ref.file)
    let position = opts.position
    let label = opts.label
    if (source) {
      const parsed = parseFrontmatter(source)
      if (parsed) {
        if (position === undefined) {
          const existing = getFrontmatterScalar(parsed.raw, 'sidebar_position')
          if (existing) position = Number(existing)
        }
        if (label === undefined)
          label = getFrontmatterScalar(parsed.raw, 'sidebar_label') ?? undefined
      }
    }
    if (position !== undefined || label !== undefined) {
      actions.push({ kind: 'frontmatter', file: ref.file, position, label })
    }
  }

  const processItems = (items: JValue[], parentDir: string): void => {
    for (const item of items) {
      if (typeof item === 'string') {
        handleDoc(item, parentDir, {})
        continue
      }
      if (!isJObject(item)) {
        manual(
          'docusaurus/sidebars-unresolved',
          'Sidebar entry could not be interpreted',
          'An entry uses an expression the migrator cannot read. Recreate it with Boltdocs navigation conventions.',
        )
        continue
      }

      const type = asString(item.type)
      if (type === 'category') {
        const label = asString(item.label) ?? asString(item.title)
        const dirName = asString(item.dirName)
        const targetDir = label
          ? path.join(parentDir, slug(label))
          : dirName
            ? path.join(parentDir, dirName)
            : parentDir
        const meta: MetaValue = {
          title: label,
          order: asNumber(item.position),
          collapsible:
            typeof item.collapsible === 'boolean'
              ? item.collapsible
              : undefined,
          collapsed:
            typeof item.collapsed === 'boolean' ? item.collapsed : undefined,
        }
        if (
          targetDir !== parentDir ||
          Object.values(meta).some((v) => v !== undefined)
        ) {
          addMeta(metaActions, targetDir, meta)
        }
        if (
          item.className !== undefined ||
          item.customProps !== undefined ||
          item.link !== undefined
        ) {
          manual(
            'docusaurus/sidebars-category-props',
            `Category '${label ?? dirName ?? '?'}' has properties without a Boltdocs equivalent`,
            'className, customProps and link on a category need manual recreation with theme/layout customization.',
          )
        }
        processItems(asArray(item.items), targetDir)
        continue
      }

      if (type === 'autogenerated') {
        const dirName = asString(item.dirName)
        if (dirName) {
          addMeta(metaActions, path.join(parentDir, dirName), {
            title: asString(item.label),
          })
        }
        findings.push(
          finding({
            id: 'docusaurus/sidebars-autogenerated',
            severity: 'info',
            action: 'manual',
            title: 'Autogenerated sidebar section — verify after migration',
            detail: `Boltdocs discovers routes from the filesystem automatically. Check the generated sidebar for ${dirName ? `docs/${dirName}` : 'this section'} and adjust meta.json if needed.`,
            file: 'sidebars.js',
          }),
        )
        continue
      }

      if (type === 'link' || type === 'ref') {
        manual(
          'docusaurus/sidebars-external',
          `Sidebar ${type === 'link' ? 'link' : 'ref'} entry needs manual mapping`,
          asString(item.href)
            ? `External target ${asString(item.href)} cannot become a documentation route. Recreate it as a navbar/external link.`
            : 'A ref/link entry has no equivalent in Boltdocs filesystem navigation.',
        )
        continue
      }

      if (type === 'doc' || type === undefined) {
        const id = asString(item.id) ?? asString(item.docId)
        if (!id) {
          manual(
            'docusaurus/sidebars-unresolved',
            'Doc sidebar entry has no id',
            'Cannot determine which page this entry points to.',
          )
          continue
        }
        handleDoc(id, parentDir, {
          label: asString(item.label),
          position: asNumber(item.position),
        })
        continue
      }

      manual(
        'docusaurus/sidebars-unknown-type',
        `Sidebar type '${type}' needs manual mapping`,
        'Boltdocs navigation is filesystem-driven; recreate this entry with folders, frontmatter and meta.json.',
      )
    }
  }

  for (const [name, definition] of Object.entries(parsed)) {
    if (Array.isArray(definition)) {
      processItems(definition, path.join(root, docsDir))
    } else {
      manual(
        'docusaurus/sidebars-shape',
        `Sidebar '${name}' is not an array`,
        'Only literal arrays were migrated; rebuild this sidebar with Boltdocs conventions.',
      )
    }
  }

  for (const [dir, meta] of metaActions) {
    const existing = readMeta(dir)
    const changed = Object.entries(meta).some(
      ([key, value]) => value !== undefined && existing?.[key] !== value,
    )
    if (changed) actions.push({ kind: 'meta', dir, meta })
  }

  return { actions, findings }
}

function applySidebarPlan(plan: SidebarPlan): void {
  for (const action of plan.actions) {
    if (action.kind === 'move') {
      fs.mkdirSync(path.dirname(action.to), { recursive: true })
      try {
        fs.renameSync(action.from, action.to)
      } catch {
        fs.copyFileSync(action.from, action.to)
        try {
          fs.rmSync(action.from)
        } catch {}
      }
      continue
    }
    if (action.kind === 'meta') {
      const existing = readJsonRecord(path.join(action.dir, 'meta.json')) ?? {}
      const merged: JsonRecord = { ...existing }
      for (const [key, value] of Object.entries(action.meta)) {
        if (value !== undefined) merged[key] = value
      }
      writeText(
        path.join(action.dir, 'meta.json'),
        `${JSON.stringify(merged, null, 2)}\n`,
      )
      continue
    }
    const source = readText(action.file)
    if (!source) continue
    const parsed = parseFrontmatter(source)
    if (!parsed) continue
    let raw = parsed.raw
    if (action.position !== undefined) {
      raw = replaceFrontmatterField(raw, 'sidebar_position', 'sidebarPosition')
      if (!/^[ \t]*sidebarPosition[ \t]*:/m.test(raw)) {
        raw = `${raw.trimEnd()}\nsidebarPosition: ${action.position}`
      } else {
        raw = raw.replace(
          /^([ \t]*sidebarPosition[ \t]*:[ \t]*).*$/m,
          `$1${action.position}`,
        )
      }
    }
    if (action.label !== undefined) {
      raw = replaceFrontmatterField(raw, 'sidebar_label', 'sidebarLabel')
      if (!/^[ \t]*sidebarLabel[ \t]*:/m.test(raw)) {
        raw = `${raw.trimEnd()}\nsidebarLabel: ${JSON.stringify(action.label)}`
      } else {
        raw = raw.replace(
          /^([ \t]*sidebarLabel[ \t]*:[ \t]*).*$/m,
          `$1${JSON.stringify(action.label)}`,
        )
      }
    }
    fs.writeFileSync(
      action.file,
      serializeFrontmatter(raw, parsed.body, parsed.eol, parsed.bom),
      'utf-8',
    )
  }
}

/** Migrate a Docusaurus `sidebars.*` file into Boltdocs navigation. */
export function migrateSidebars(
  root: string,
  docsDir: string,
  apply: boolean,
): { findings: MigrationFinding[]; applied: MigrationFinding[] } {
  const file = [
    'sidebars.js',
    'sidebars.ts',
    'sidebars.cjs',
    'sidebars.mjs',
  ].find((name) => exists(path.join(root, name)))
  if (!file) return { findings: [], applied: [] }

  const source = readText(path.join(root, file)) ?? ''
  const plan = planSidebars(root, docsDir, source)
  const findings: MigrationFinding[] = [...plan.findings]
  const applied: MigrationFinding[] = []

  if (plan.actions.length > 0) {
    const moves = plan.actions.filter((a) => a.kind === 'move').length
    const metas = plan.actions.filter((a) => a.kind === 'meta').length
    const fields = plan.actions.filter((a) => a.kind === 'frontmatter').length
    const f = finding({
      id: 'docusaurus/sidebars',
      severity: 'warning',
      action: 'fixable',
      title: 'Map Docusaurus sidebar into Boltdocs navigation',
      detail: `Rebuilds the sidebar with ${moves} file move(s), ${metas} meta.json update(s) and ${fields} frontmatter update(s). Boltdocs derives navigation from folders, sidebarPosition/sidebarLabel and meta.json.`,
      file,
      remediation:
        'Apply the sidebar codemod, then review the generated structure.',
    })
    findings.push(f)
    if (apply) {
      applySidebarPlan(plan)
      applied.push(f)
    }
  } else if (plan.findings.length === 0) {
    findings.push(
      finding({
        id: 'docusaurus/sidebars-noop',
        severity: 'info',
        action: 'manual',
        title: 'Sidebar config needs no automatic changes',
        detail:
          'No sidebars.* mapping was produced. Verify the generated navigation matches the original tree.',
        file,
      }),
    )
  }

  return { findings, applied }
}
