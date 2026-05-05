import { ArrowLeft } from 'lucide-react'
import { Link } from '../primitives/link'

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-center">
      <div className="space-y-4">
        <span className="text-8xl font-black tracking-tighter text-primary-500/20">
          404
        </span>
        <h1 className="text-2xl font-bold text-body">Page Not Found</h1>
        <p className="text-sm text-muted max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition-all hover:brightness-110 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary-500/30"
        >
          <ArrowLeft size={16} /> Go to Home
        </Link>
      </div>
    </div>
  )
}
