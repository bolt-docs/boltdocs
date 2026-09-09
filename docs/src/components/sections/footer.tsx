import { Link } from 'boltdocs/primitives'
import { Github, Instagram, Twitter } from '@/theme/icons'
import { X } from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { Section } from '@/theme/section'

interface FooterLink {
  href: string
  label: string
  external?: boolean
}

export const Footer = () => {
  const t = useTranslations()

  const docs: FooterLink[] = [
    { href: '/docs/guides', label: t.footerDocumentation },
    { href: '/docs/api', label: t.footerApiReference },
    { href: '/docs/releases', label: t.footerChangelog },
    { href: 'site:/blog', label: t.footerBlog },
  ]

  const resources: FooterLink[] = [
    { href: 'site:/roadmap', label: 'Roadmap' },
    { href: 'site:/about', label: t.footerAbout },
    { href: 'site:/rss.xml', label: 'RSS Feed' },
  ]

  const community: FooterLink[] = [
    {
      href: 'https://github.com/jesusalcaladev/boltdocs',
      label: t.footerGitHub,
      external: true,
    },
    {
      href: 'https://github.com/jesusalcaladev/boltdocs/CONTRIBUTING.md',
      label: t.footerContributing,
      external: true,
    },
    {
      href: 'https://github.com/jesusalcaladev/boltdocs/issues',
      label: t.footerIssues,
      external: true,
    },
  ]

  return (
    <Section maxWidth="lg">
      <div className="flex flex-row gap-28 ">
        <FooterColumns title="Documentation" links={docs} />
        <FooterColumns title="Resources" links={resources} />
        <FooterColumns title="Community" links={community} />
      </div>

      <div className="mt-14 mb-5 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/jesusalcaladev/boltdocs"
            aria-label="GitHub"
            className="hover:scale-105 transition-transform"
          >
            <Github className="size-7" />
          </Link>
          <Link
            href="https://www.instagram.com/boldocts26"
            aria-label="Instagram"
            className="hover:scale-105 transition-transform"
          >
            <Instagram className="size-6" />
          </Link>
          <Link
            href="https://x.com/JesusAlcal41649"
            aria-label="X / Twitter"
            className="hover:scale-105 transition-transform"
          >
            <Twitter className="size-5" />
          </Link>
        </div>
        <p className="text-sm">
          © {new Date().getFullYear()} Boltdocs. MIT License.
        </p>
      </div>
    </Section>
  )
}

function FooterColumns({
  title,
  links,
}: {
  title: string
  links: FooterLink[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-wide text-body">{title}</h3>
      <ul className="flex flex-col gap-1 mt-5">
        {links.map((link) => (
          <li key={link.label + link.href}>
            <Link
              href={link.href}
              className="text-sm text-paragraph transition-all duration-300 hover:text-primary-400 hover:translate-x-1"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
