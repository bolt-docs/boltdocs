import { cn } from 'boltdocs/client'
import { Link } from 'boltdocs/primitives'
import { useRef } from 'react'
import { useGSAPStaggerIn } from '../hooks/useGSAPScroll'

export default function AboutPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Apply a clean, minimalist vertical fade-up stagger on all child paragraphs/headers
  useGSAPStaggerIn(contentRef, { stagger: 0.08, duration: 0.6, y: 15 })

  return (
    <div className="font-sans antialiased min-h-screen bg-main text-body flex flex-col justify-start">
      <div className="max-w-2xl mx-auto px-6 py-28 md:py-36 w-full flex-grow">
        <div ref={contentRef} className="flex flex-col gap-10">
          
          {/* Header Metadata */}
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-primary-400 block mb-3">
              About the project
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-body tracking-tight leading-tight">
              Boltdocs
            </h1>
            <div className="w-full h-px bg-white/10 mt-8" />
          </div>

          {/* Section: Our Mission */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              Our Mission
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Writing documentation is often treated as an afterthought because the tools to build it are either too complex, too slow, or visually unappealing by default. We created Boltdocs to provide a zero-configuration, edge-ready, and highly customizable engine that teams actually enjoy using.
            </p>
          </div>

          {/* Section: Open Source */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              Open Source
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Boltdocs is proudly open source under the MIT License. We believe the best tools are built collaboratively, and we welcome contributions from developers all around the world.
            </p>
          </div>

          {/* Section: The Developer */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              The Developer
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Boltdocs is built and maintained by <strong className="text-body font-bold">Jesus Alcala</strong>. Passionate about enhancing developer productivity, Jesus created Boltdocs to solve common documentation pain points and deliver a superior writing experience.
            </p>
            
            <div className="pt-3">
              <Link
                href="https://github.com/jesusalcaladev"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-body font-bold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer text-sm"
              >
                <GithubIcon className="w-4.5 h-4.5" /> Follow @jesusalcaladev on GitHub
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn("w-4 h-4 transition-transform group-hover:scale-110", className)}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <title>Github</title>
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
)
