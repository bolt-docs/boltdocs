export type Severity = 'off' | 'high' | 'warning' | 'low'

export interface DoctorConfig {
  $schema?: string
  checks: {
    metadata: {
      enabled: boolean
      titleMin: number
      titleMax: number
      descriptionMin: number
      required: string[]
      optional: string[]
      validateDates: boolean
    }
    links: {
      internal: boolean
      external: boolean
      timeout: number
      concurrency: number
      ignore: string[]
    }
    i18n: {
      enabled: boolean
    }
    performance: {
      enabled: boolean
      budgets: {
        maxJSBundleSize: string
        maxCSSBundleSize: string
        maxPageHTMLSize: string
        maxImagesKB: number
        maxBuildTime: number
        maxFontCount: number
      }
    }
  }
  fix: {
    confirmChanges: boolean
    backupFiles: boolean
    backupPath: string
  }
  reporting: {
    format: 'pretty' | 'json'
    outputFile: string
    failOnError: boolean
    maxWarnings: number
  }
  severity: Record<string, Severity>
  exclude: string[]
}
