import type { RouteMeta } from '../../shared/types'

export type { RouteMeta }

/**
 * Internal representation of a parsed documentation file before finalizing groups.
 * Stored in the file cache to avoid re-parsing unchanged files.
 */
export interface ParsedDocFile {
  /** The core route metadata without group-level details (inferred later) */
  route: Omit<RouteMeta, 'group' | 'groupTitle' | 'groupPosition'>
  /** The base directory of the file (used to group files together) */
  relativeDir?: string
  /** Whether this file is the index file for its directory group */
  isGroupIndex: boolean
  /** If this is a group index, any specific frontmatter metadata dictating the group's title and position */
  groupMeta?: { title: string; position?: number; icon?: string }
  /** Extracted group position from the directory name if it has a numeric prefix */
  inferredGroupPosition?: number
  /** Extracted tab name from the directory name if it follows the (tab-name) syntax */
  inferredTab?: string
  /** Extracted collection name from the [name] directory syntax */
  inferredCollection?: string
}
