/**
 * Base class for all security-related violations in Boltdocs.
 */
export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityViolationError'
    // Ensure the prototype is set correctly for instanceof checks in older TS versions
    Object.setPrototypeOf(this, SecurityViolationError.prototype)
  }
}

/**
 * Specifically for directory traversal attempts and related filesystem breaches.
 */
export class PathTraversalError extends SecurityViolationError {
  constructor(message: string) {
    super(message)
    this.name = 'PathTraversalError'
    Object.setPrototypeOf(this, PathTraversalError.prototype)
  }
}

/**
 * Specifically for invalid or malicious character encoding in paths.
 */
export class EncodingSecurityError extends SecurityViolationError {
  constructor(message: string) {
    super(message)
    this.name = 'EncodingSecurityError'
    Object.setPrototypeOf(this, EncodingSecurityError.prototype)
  }
}

/**
 * Specifically for schema or size validation failures in inputs (like frontmatter).
 */
export class ValidationError extends SecurityViolationError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}
