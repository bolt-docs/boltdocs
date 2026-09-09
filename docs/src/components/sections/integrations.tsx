import { Sigma } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslations } from '@/i18n/index'
import {
  Algolia,
  Mermaid,
  PostHog,
  RSS,
  Disqus,
  TailwindCSS,
  SASS,
  UnoCSS,
  GoogleAnalytics,
  GoogleTabManager,
  MDX,
  Vercel,
} from '@/components/sections/icons-integrations'
import { Section } from '@/theme'

type Integration = { name: string; icon: ReactNode }

const INTEGRATIONS: Integration[] = [
  { name: 'MDX', icon: <MDX className="size-[1.9rem]" /> },
  { name: 'Mermaid', icon: <Mermaid className="size-[1.9rem]" /> },
  { name: 'KaTeX Math', icon: <Sigma className="size-[1.9rem]" /> },
  { name: 'Disqus', icon: <Disqus className="size-[1.9rem]" /> },
  { name: 'Tailwindcss', icon: <TailwindCSS className="size-[1.9rem]" /> },
  { name: 'Sass', icon: <SASS className="size-[1.9rem]" /> },
  { name: 'UnoCSS', icon: <UnoCSS className="size-[1.9rem]" /> },
  {
    name: 'GoogleAnalytics',
    icon: <GoogleAnalytics className="size-[1.9rem]" />,
  },
  {
    name: 'GoogleTabManager',
    icon: <GoogleTabManager className="size-[1.9rem]" />,
  },
  { name: 'Vercel', icon: <Vercel className="size-[1.9rem] text-white" /> },
  { name: 'Algolia', icon: <Algolia className="size-[1.9rem]" /> },
  { name: 'PostHog', icon: <PostHog className="size-[1.9rem]" /> },
  { name: 'RSS', icon: <RSS className="size-[1.9rem]" /> },
]

export const Integrations = () => {
  const t = useTranslations()

  return (
    <Section maxWidth="lg">
      <div className="mb-8">
        <h2 className="text-center text-4xl font-extrabold tracking-tighter text-body">
          {t.integrationsTitle}
        </h2>
      </div>

      <section className="flex w-full flex-row gap-10 flex-wrap justify-center mt-10">
        {INTEGRATIONS.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5">
            <span>{item.icon}</span>
          </div>
        ))}
      </section>
    </Section>
  )
}
