import path from 'node:path'
import type { IconLibrary } from '../cli'
import { writeFile } from './file-system'

export const ICON_LIBRARY_VERSIONS: Record<IconLibrary, string> = {
  'lucide-react': '^0.487.0',
  '@heroicons/react': '^2.2.0',
  '@phosphor-icons/react': '^2.4.1',
}

export const ICON_IMPORTS: Record<IconLibrary, string> = {
  'lucide-react':
    "import { Route, FileText, Settings, Sparkles, BookOpen, Rocket } from 'lucide-react'",
  '@heroicons/react': `import {
  MapIcon as Route,
  DocumentTextIcon as FileText,
  Cog8ToothIcon as Settings,
  SparklesIcon as Sparkles,
  BookOpenIcon as BookOpen,
  RocketLaunchIcon as Rocket,
} from '@heroicons/react/24/outline'`,
  '@phosphor-icons/react':
    "import { Route, FileText, Settings, Sparkles, BookOpen, Rocket } from '@phosphor-icons/react'",
}

export function getIconLibraryVersion(iconLibrary: IconLibrary): string {
  return ICON_LIBRARY_VERSIONS[iconLibrary]
}

export function generateIconsFile(
  projectDir: string,
  iconLibrary: IconLibrary,
): void {
  const content = `${ICON_IMPORTS[iconLibrary]}

const icons = {
  Route,
  FileText,
  Settings,
  Sparkles,
  BookOpen,
  Rocket,
}

export { Route, FileText, Settings, Sparkles, BookOpen, Rocket }
export default icons
`

  writeFile(path.join(projectDir, 'docs', 'icons.tsx'), content)
}
