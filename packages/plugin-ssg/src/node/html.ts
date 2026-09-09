import { join } from 'node:path'
import fs from 'fs-extra'

export const SCRIPT_COMMENT_PLACEHOLDER = '/* SCRIPT_COMMENT_PLACEHOLDER */'

type HtmlTemplateRenderOptions = {
  appHTML: string
  metaAttributes: string[]
  bodyAttributes: string
  htmlAttributes: string
  initialState: any
}

export type HtmlTemplate = (options: HtmlTemplateRenderOptions) => string

function mergeOpeningTagAttributes(
  html: string,
  tagName: 'html' | 'body',
  attributes: string,
): string {
  const additions = attributes.trim()
  if (!additions) return html

  const match = new RegExp(`<${tagName}\\b([^>]*)>`, 'i').exec(html)
  if (!match) return html

  const keys = [...additions.matchAll(/(?:^|\s)([A-Za-z_:][\w:.-]*)\s*=/g)].map(
    (entry) => entry[1],
  )
  let existing = match[1]
  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    existing = existing.replace(
      new RegExp(
        `\\s+${escapedKey}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`,
        'gi',
      ),
      '',
    )
  }

  const merged = existing.trim() ? `${existing.trim()} ${additions}` : additions
  return html.replace(match[0], `<${tagName} ${merged}>`)
}

/**
 * Compiles the common index.html shape into a zero-scan renderer.
 *
 * The existing parser-based `renderHTML` remains the correctness fallback for
 * custom templates. This fast path is only used when every marker appears
 * exactly once, preserving the old first-replacement semantics.
 */
export function createHtmlTemplate({
  rootContainerId,
  indexHTML,
}: {
  rootContainerId: string
  indexHTML: string
}): HtmlTemplate | null {
  const container = `<div id="${rootContainerId}"></div>`
  const markers = [
    { token: '<html', kind: 'html' as const },
    { token: '<head>', kind: 'head' as const },
    { token: '<body', kind: 'body' as const },
    { token: container, kind: 'container' as const },
  ]
    .map(({ token, kind }) => ({
      kind,
      token,
      index: indexHTML.indexOf(token),
      lastIndex: indexHTML.lastIndexOf(token),
    }))
    .sort((a, b) => a.index - b.index)

  if (
    markers.some(
      (marker) => marker.index < 0 || marker.index !== marker.lastIndex,
    )
  ) {
    return null
  }

  const segments: Array<{
    text: string
    kind?: (typeof markers)[number]['kind']
  }> = []
  let cursor = 0
  for (const marker of markers) {
    segments.push({ text: indexHTML.slice(cursor, marker.index) })
    segments.push({ kind: marker.kind, text: '' })
    cursor = marker.index + marker.token.length
  }
  segments.push({ text: indexHTML.slice(cursor) })

  return ({
    appHTML,
    metaAttributes,
    bodyAttributes,
    htmlAttributes,
    initialState,
  }) => {
    const stateScript = initialState
      ? `\n<script>window.__INITIAL_STATE__=${initialState}</script>`
      : ''
    const scriptPlaceHolder = `\n<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`
    const metaTags = metaAttributes.join('')
    const renderedContainer = `<div id="${rootContainerId}" data-server-rendered="true">${appHTML}</div>${stateScript}${scriptPlaceHolder}`

    const rendered = segments
      .map((segment) => {
        if (!segment.kind) return segment.text
        switch (segment.kind) {
          case 'html':
            return '<html'
          case 'head':
            return `<head>${metaTags}`
          case 'body':
            return '<body'
          case 'container':
            return renderedContainer
          default:
            return segment.text
        }
      })
      .join('')

    return mergeOpeningTagAttributes(
      mergeOpeningTagAttributes(rendered, 'html', htmlAttributes),
      'body',
      bodyAttributes,
    )
  }
}

export async function renderHTML({
  rootContainerId,
  indexHTML,
  appHTML,
  metaAttributes,
  bodyAttributes,
  htmlAttributes,
  initialState,
}: {
  rootContainerId: string
  indexHTML: string
  appHTML: string
  metaAttributes: string[]
  bodyAttributes: string
  htmlAttributes: string
  initialState: any
}) {
  const stateScript = initialState
    ? `\n<script>window.__INITIAL_STATE__=${initialState}</script>`
    : ''

  const scriptPlaceHolder = `\n<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`
  const metaTags = metaAttributes.join('')
  const container = `<div id="${rootContainerId}"></div>`

  // Single-pass HTML injection
  if (indexHTML.includes(container)) {
    const rendered = indexHTML
      .replace('<head>', `<head>${metaTags}`)
      .replace(
        container,
        `<div id="${rootContainerId}" data-server-rendered="true">${appHTML}</div>${stateScript}${scriptPlaceHolder}`,
      )

    return mergeOpeningTagAttributes(
      mergeOpeningTagAttributes(rendered, 'html', htmlAttributes),
      'body',
      bodyAttributes,
    )
  }

  const html5Parser = await import('html5parser')
  const ast = html5Parser.parse(indexHTML)
  let renderedOutput: string | undefined

  html5Parser.walk(ast, {
    enter: (node) => {
      if (
        !renderedOutput &&
        node?.type === html5Parser.SyntaxKind.Tag &&
        Array.isArray(node.attributes) &&
        node.attributes.length > 0 &&
        node.attributes.some(
          (attr) =>
            attr.name.value === 'id' && attr.value?.value === rootContainerId,
        )
      ) {
        const attributesStringified = [
          ...node.attributes.map(
            ({ name: { value: name }, value }) => `${name}="${value!.value}"`,
          ),
        ].join(' ')
        const indexHTMLBefore = indexHTML.slice(0, node.start)
        const indexHTMLAfter = indexHTML.slice(node.end)
        renderedOutput = `${indexHTMLBefore}<${node.name} ${attributesStringified} data-server-rendered="true">${appHTML}</${node.name}>${stateScript}${scriptPlaceHolder}${indexHTMLAfter}`
      }
    },
  })

  if (!renderedOutput)
    throw new Error(
      `Could not find a tag with id="${rootContainerId}" to replace it with server-side rendered HTML`,
    )

  return mergeOpeningTagAttributes(
    mergeOpeningTagAttributes(renderedOutput, 'html', htmlAttributes),
    'body',
    bodyAttributes,
  )
}

export async function detectEntry(
  root: string,
  htmlEntry: string = 'index.html',
) {
  // pick the first script tag of type module as the entry
  // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-useless-non-capturing-group, regexp/no-dupe-characters-character-class, regexp/no-useless-lazy, regexp/no-useless-flag, regexp/no-useless-escape, regexp/strict
  const scriptSrcReg =
    /<script(?:.*?)src=["'](.+?)["'](?!<)(?:.*)>(?:[\n\r\s]*?)(?:<\/script>)/gim
  const html = await fs.readFile(join(root, htmlEntry), 'utf-8')
  const scripts = [...html.matchAll(scriptSrcReg)]
  const [, entry] =
    scripts.find((matchResult) => {
      const [script] = matchResult
      const [, scriptType] = script.match(/.*\stype=(?:'|")?([^>'"\s]+)/i) || []
      return scriptType === 'module'
    }) || []
  return entry || 'src/main.ts'
}

export function createLink(href: string) {
  return `<link rel="stylesheet" href="${href}">`
}
