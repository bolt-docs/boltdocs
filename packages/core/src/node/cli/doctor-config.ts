/**
 * Configuration for the boltdocs doctor command.
 * This schema defines the structure of doctor.json.
 */
export interface DoctorConfig {
  /**
   * Path to the JSON schema for validation and autocompletion.
   */
  $schema?: string

  /**
   * Configuration for specific documentation health checks.
   */
  checks: {
    /**
     * Metadata and SEO related checks (title, description, frontmatter).
     */
    metadata: {
      enabled: boolean
      /**
       * Minimum character length for page titles.
       */
      titleMin: number
      /**
       * Maximum character length for page titles.
       */
      titleMax: number
      /**
       * Minimum character length for page descriptions.
       */
      descriptionMin: number
      /**
       * List of frontmatter fields that MUST be present.
       */
      required: string[]
      /**
       * List of optional frontmatter fields that are allowed.
       */
      optional: string[]
      /**
       * Whether to validate date formats in frontmatter.
       */
      validateDates: boolean
    }
    /**
     * Link validation (internal and external).
     */
    links: {
      /**
       * Whether to check internal documentation links.
       */
      internal: boolean
      /**
       * Whether to check external website links.
       */
      external: boolean
      /**
       * Timeout in milliseconds for external link checks.
       */
      timeout: number
      /**
       * Maximum number of parallel external link requests.
       */
      concurrency: number
      /**
       * List of URL patterns to ignore during link checking.
       */
      ignore: string[]
    }
    /**
     * Internationalization (i18n) consistency checks.
     */
    i18n: {
      enabled: boolean
    }
  }
  /**
   * Automated fix behavior and safety settings.
   */
  fix: {
    /**
     * Ask for confirmation before applying each automated fix.
     */
    confirmChanges: boolean
    /**
     * Create a backup copy of files before modifying them.
     */
    backupFiles: boolean
    /**
     * Directory path where backups will be stored.
     */
    backupPath: string
  }
  /**
   * Configuration for diagnostic reports and CI/CD exit behavior.
   */
  reporting: {
    /**
     * Output format of the report.
     */
    format: 'pretty' | 'json' | 'silent'
    /**
     * Optional file path to save the diagnostic report (JSON).
     */
    outputFile?: string
    /**
     * Exit with a non-zero code if critical errors are found (for CI).
     */
    failOnError: boolean
    /**
     * Maximum number of allowed warnings before exiting with error. Use -1 for no limit.
     */
    maxWarnings: number
  }
  /**
   * Severity overrides for different types of issues.
   * Can be 'high', 'warning', 'low', or 'off'.
   */
  severity: {
    [key: string]: 'high' | 'warning' | 'low' | 'off'
  }
  /**
   * List of glob patterns to exclude from analysis.
   */
  exclude: string[]
}
