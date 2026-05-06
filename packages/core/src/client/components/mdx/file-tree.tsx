import { Children, isValidElement, useMemo } from 'react'
import * as RAC from 'react-aria-components'
import {
  Folder,
  FileText,
  File,
  FileCode,
  FileImage,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../../utils/cn'

import {
  TypeScript,
  JavaScript,
  React as ReactIcon,
  Json,
  Css,
  BracketsOrange,
  Markdown,
  Shell,
  Yaml,
} from '../icons-dev'

// --- Constants & Types ---

const ICON_SIZE = 16
const STROKE_WIDTH = 2

const FILE_EXTENSION_MAP: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  ts: TypeScript,
  tsx: ReactIcon,
  js: JavaScript,
  jsx: ReactIcon,
  json: Json,
  css: Css,
  html: BracketsOrange,
  md: Markdown,
  mdx: Markdown,
  bash: Shell,
  sh: Shell,
  yaml: Yaml,
  yml: Yaml,
}

const FILE_REGEXES = {
  CODE: /\.(ts|tsx|js|jsx|json|mjs|cjs|astro|vue|svelte)$/i,
  TEXT: /\.(md|mdx|txt)$/i,
  IMAGE: /\.(png|jpg|jpeg|svg|gif)$/i,
} as const

export interface FileTreeProps {
  children: React.ReactNode
}

interface TreeItemData {
  id: string
  name: string
  comment?: string
  isFolder: boolean
  children?: TreeItemData[]
}

// --- Helpers ---

function getTextContent(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return node.toString()
  if (Array.isArray(node)) return node.map(getTextContent).join('')
  if (
    isValidElement(node) &&
    node.props &&
    typeof node.props === 'object' &&
    'children' in node.props
  ) {
    return getTextContent(
      (node.props as { children?: React.ReactNode }).children,
    )
  }
  return ''
}

function getFileIcon(filename: string, isFolder: boolean) {
  const name = filename.toLowerCase()
  const iconClass = 'shrink-0 transition-colors duration-200'

  if (isFolder) {
    return (
      <Folder
        size={ICON_SIZE}
        strokeWidth={STROKE_WIDTH}
        className={cn(iconClass, 'text-primary-400')}
        fill="currentColor"
        fillOpacity={0.15}
      />
    )
  }

  // Check for specialized language icons
  const extension = name.split('.').pop() || ''
  const LangIcon = FILE_EXTENSION_MAP[extension]
  if (LangIcon) {
    return <LangIcon size={ICON_SIZE} />
  }

  const fileIconClass = cn(iconClass, 'text-dim group-hover:text-body')

  if (FILE_REGEXES.CODE.test(name))
    return (
      <FileCode
        size={ICON_SIZE}
        strokeWidth={STROKE_WIDTH}
        className={fileIconClass}
      />
    )
  if (FILE_REGEXES.TEXT.test(name))
    return (
      <FileText
        size={ICON_SIZE}
        strokeWidth={STROKE_WIDTH}
        className={fileIconClass}
      />
    )
  if (FILE_REGEXES.IMAGE.test(name))
    return (
      <FileImage
        size={ICON_SIZE}
        strokeWidth={STROKE_WIDTH}
        className={fileIconClass}
      />
    )

  return (
    <File
      size={ICON_SIZE}
      strokeWidth={STROKE_WIDTH}
      className={fileIconClass}
    />
  )
}

function isListElement(
  node: unknown,
  tag: 'ul' | 'li',
): node is React.ReactElement<{ children?: React.ReactNode }> {
  if (!isValidElement(node)) return false

  const type = node.type
  if (typeof type === 'string') return type === tag
  if (typeof type === 'function') {
    return type.name === tag || type.name?.toLowerCase() === tag
  }

  const props = node.props as any
  return props?.originalType === tag || props?.mdxType === tag
}

function parseLabel(rawLabel: string): { name: string; comment?: string } {
  const commentMatch = rawLabel.match(/\s+(\/\/|#)\s+(.*)$/)
  if (commentMatch) {
    return {
      name: rawLabel.slice(0, commentMatch.index).trim(),
      comment: commentMatch[2],
    }
  }
  return { name: rawLabel.trim() }
}

function parseMdxToData(
  node: React.ReactNode,
  path: string = 'root',
): TreeItemData[] {
  if (!isValidElement(node)) return []

  const items: TreeItemData[] = []

  if (isListElement(node, 'ul')) {
    Children.forEach(
      (node.props as { children?: React.ReactNode }).children,
      (child, index) => {
        items.push(...parseMdxToData(child, `${path}-${index}`))
      },
    )
    return items
  }

  if (isListElement(node, 'li')) {
    const children = Children.toArray(
      (node.props as { children?: React.ReactNode }).children,
    )
    const nestedListIndex = children.findIndex((child) =>
      isListElement(child, 'ul'),
    )

    const hasNested = nestedListIndex !== -1
    const labelNodes = hasNested ? children.slice(0, nestedListIndex) : children
    const nestedNodes = hasNested ? children.slice(nestedListIndex) : []

    const rawLabelContent = getTextContent(labelNodes)
    const { name, comment } = parseLabel(rawLabelContent)

    const isExplicitDir = name.endsWith('/')
    const labelText = isExplicitDir ? name.slice(0, -1) : name
    const isFolder = hasNested || isExplicitDir

    items.push({
      id: `${path}-${labelText}`,
      name: labelText,
      comment,
      isFolder,
      children: hasNested
        ? parseMdxToData(nestedNodes[0], `${path}-${labelText}`)
        : undefined,
    })
    return items
  }

  if (
    node.props &&
    typeof node.props === 'object' &&
    'children' in node.props
  ) {
    Children.forEach(
      (node.props as { children?: React.ReactNode }).children,
      (child, index) => {
        items.push(...parseMdxToData(child, `${path}-${index}`))
      },
    )
  }

  return items
}

// --- Sub-Components ---

function FileTreeNode({ item }: { item: TreeItemData }) {
  return (
    <RAC.TreeItem
      id={item.id}
      textValue={item.name}
      className="outline-none group focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-md"
    >
      <RAC.TreeItemContent>
        {({ isExpanded, hasChildItems }) => (
          <div className="flex items-center gap-2 py-1 px-1.5 rounded-md transition-colors hover:bg-primary-500/5 cursor-pointer">
            <div
              style={{ width: `calc((var(--tree-item-level) - 1) * 1rem)` }}
              className="shrink-0"
            />
            {hasChildItems ? (
              <RAC.Button
                slot="chevron"
                className="outline-none text-dim hover:text-primary-400 p-0.5 rounded transition-colors"
              >
                <ChevronRight
                  size={14}
                  strokeWidth={3}
                  className={cn(
                    'transition-transform duration-200',
                    isExpanded && 'rotate-90',
                  )}
                />
              </RAC.Button>
            ) : (
              <div className="w-[18px]" />
            )}

            {getFileIcon(item.name, item.isFolder)}

            <span
              className={cn(
                'text-sm transition-colors truncate select-none',
                item.isFolder
                  ? 'font-semibold text-body'
                  : 'text-muted group-hover:text-body',
              )}
            >
              {item.name}
            </span>

            {item.comment && (
              <span className="ml-2 text-xs italic text-dim opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis font-sans">
                {'//'} {item.comment}
              </span>
            )}
          </div>
        )}
      </RAC.TreeItemContent>

      {item.children && (
        <RAC.Collection items={item.children}>
          {(child) => <FileTreeNode item={child} />}
        </RAC.Collection>
      )}
    </RAC.TreeItem>
  )
}

// --- Main Component ---

export function FileTree({ children }: FileTreeProps) {
  const items = useMemo(() => parseMdxToData(children), [children])

  return (
    <div className="my-8">
      <RAC.Tree
        items={items}
        aria-label="File Tree"
        className={cn(
          'rounded-xl border border-subtle bg-surface/50 p-4 font-mono text-sm shadow-sm backdrop-blur-sm outline-none',
          'max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-subtle',
          'focus-visible:ring-2 focus-visible:ring-primary-500/20',
        )}
      >
        {(item) => <FileTreeNode item={item} />}
      </RAC.Tree>
    </div>
  )
}
