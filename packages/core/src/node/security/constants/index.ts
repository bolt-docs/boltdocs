/**
 * Security limits for file system operations.
 */
export const MAX_PATH_LENGTH = 260
export const ALLOWED_PATH_CHARS = /^[a-zA-Z0-9\-_/.()[\]]+$/

/**
 * Security limits for document metadata (frontmatter).
 */
export const MAX_FRONTMATTER_SIZE = 10 * 1024 // 10KB
