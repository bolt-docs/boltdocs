import type { BoltdocsConfig } from '../config'
import type { DoctorConfig } from './doctor-config'

export interface LinkTree {
  routes: string[]
  timestamp: number
}

export type { DoctorConfig }

export const DEFAULT_DOCTOR_CONFIG: DoctorConfig = {
  $schema: 'https://boltdocs.vercel.app/schemas/doctor-config.schema.json',
  checks: {
    metadata: {
      enabled: true,
      titleMin: 10,
      titleMax: 60,
      descriptionMin: 50,
      required: ['title', 'description'],
      optional: [],
      validateDates: false,
    },
    links: {
      internal: true,
      external: false,
      timeout: 10000,
      concurrency: 10,
      ignore: [],
    },
    i18n: {
      enabled: true,
    },
  },
  fix: {
    confirmChanges: false,
    backupFiles: false,
    backupPath: '.boltdocs/backups',
  },
  reporting: {
    format: 'pretty',
    outputFile: '.boltdocs/doctor-report.json',
    failOnError: false,
    maxWarnings: -1,
  },
  severity: {
    missingTranslation: 'warning',
    brokenLink: 'high',
    brokenAnchor: 'warning',
    largeFile: 'warning',
    orphanedPage: 'low',
    duplicateTitle: 'low',
    shortMetadata: 'low',
    missingMetadata: 'warning',
    malformedFrontmatter: 'high',
    invalidFrontmatter: 'high',
  },
  exclude: [],
}

export interface DoctorContext {
  root: string
  docsDir: string
  config: BoltdocsConfig
  doctorConfig: DoctorConfig
  linkTree: LinkTree
  files: string[]
  options: { fix?: boolean; checkExternal?: boolean }
  routeIndex: Set<string>
  routeIndexWithSlash: Set<string>
  routeIndexWithoutSlash: Set<string>
  basePrefix: string
}

export interface DoctorIssue {
  file: string
  level: 'high' | 'warning' | 'low'
  message: string
  suggestion?: string
  fix?: () => Promise<void>
}
