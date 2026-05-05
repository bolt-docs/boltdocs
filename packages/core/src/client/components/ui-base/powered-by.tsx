import { Zap } from 'lucide-react'

export function PoweredBy() {
  return (
    <div className="flex items-center justify-center mt-10 mb-4 px-4 w-full">
      <a
        href="https://github.com/jesusalcaladev/boltdocs"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center gap-2 px-4 py-2 rounded-full border border-subtle bg-surface/50 backdrop-blur-md transition-all duration-300 hover:border-primary-500/50 hover:bg-surface hover:shadow-xl hover:shadow-primary-500/5 select-none"
      >
        <Zap
          className="w-3.5 h-3.5 text-muted group-hover:text-primary-500 transition-colors duration-300"
          fill="currentColor"
        />
        <span className="text-[11px] font-medium text-muted group-hover:text-body transition-colors duration-300 tracking-wide">
          Powered by{' '}
          <strong className="font-bold text-body/80 group-hover:text-body">
            Boltdocs
          </strong>
        </span>
      </a>
    </div>
  )
}
