import { ArrowLeft } from './icons'
import { Link } from '../primitives/link'

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[65vh] text-center px-4">
      <div className="space-y-6 max-w-md mx-auto p-8 border border-subtle bg-surface rounded-2xl shadow-xs">
        <span className="block text-7xl font-extrabold tracking-tight text-primary-500">
          404
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-body">Page Not Found</h1>
          <p className="text-sm text-muted leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-main px-6 py-2.5 text-xs font-semibold text-body hover:bg-primary-50/50 hover:border-primary-500/50 transition-all duration-300 outline-none select-none"
        >
          <ArrowLeft size={14} /> Go to Home
        </Link>
      </div>
    </div>
  )
}
