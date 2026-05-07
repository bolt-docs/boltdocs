import { Badge, Cards, cn } from 'boltdocs/client'

// Import modular theme components
import { GlassCard } from '../components/theme/glass-card'
import { CodeBlock } from '../components/theme/code-block'
import { Note, Tip, Warning, Important } from '../components/theme/admonitions'
import { CustomCopyMarkdown } from '../components/theme/copy-markdown'

const components = {
  h1: (props: any) => (
    <h1
      {...props}
      className="text-4xl font-black mb-6 custom-heading tracking-tighter"
    />
  ),
  h2: (props: any) => (
    <h2
      {...props}
      className="text-2xl font-bold mt-12 mb-4 text-white/90 border-b border-white/5 pb-2"
    />
  ),
  p: (props: any) => (
    <p {...props} className="text-lg leading-relaxed text-white/70 mb-6" />
  ),

  pre: CodeBlock,

  // Global Components
  Note,
  Tip,
  Warning,
  Important,
  Badge: (props: any) => <Badge {...props} className="glass-badge" />,
  Card: GlassCard,
  Cards,

  // Custom components for the demo
  GlassCard,
  CopyMarkdown: CustomCopyMarkdown,
}

export default components
export { components }
