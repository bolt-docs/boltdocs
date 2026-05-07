type FeatureStatus = 'planned' | 'in-progress' | 'completed' | 'released'
type FeatureCategory =
  | 'Core'
  | 'Integrations'
  | 'CLI'
  | 'UI'
  | 'API'
  | 'Ecosystem'

export interface Feature {
  name: string
  description: string
  status: FeatureStatus
  category: FeatureCategory
}

export const FEATURES: Feature[] = [
  {
    name: 'CodeSandbox Integration',
    description: 'Allow users to run code examples in CodeSandbox',
    status: 'in-progress',
    category: 'Integrations',
  },
  {
    name: 'Support Links',
    description: 'Add support links to the documentation',
    status: 'in-progress',
    category: 'Core',
  },
  {
    name: 'Google Analytics 4',
    description: 'Support for google analytics',
    status: 'completed',
    category: 'Integrations',
  },
  {
    name: 'Google Tag Manager',
    description: 'Support for google tag manager',
    status: 'completed',
    category: 'Integrations',
  },
  {
    name: 'Algolia Integration',
    description: 'Support for algolia search',
    status: 'planned',
    category: 'Integrations',
  },
  {
    name: 'Component Banner',
    description: 'Add banner to components',
    status: 'released',
    category: 'UI',
  },
  {
    name: 'Component Collapse',
    description: 'Allow users to collapse components',
    status: 'released',
    category: 'UI',
  },
  {
    name: 'Export to PDF, EPUB, MOBI',
    description: 'Allow users to export documentation to PDF, EPUB, MOBI',
    status: 'planned',
    category: 'Core',
  },
  {
    name: 'Feedback System',
    description: 'Allow users to give feedback on documentation',
    status: 'planned',
    category: 'Core',
  },
  {
    name: 'OpenAPI & Swagger Integration',
    description: 'Allow users to import OpenAPI & Swagger specifications',
    status: 'planned',
    category: 'Integrations',
  },
]
