import { ArrowLeft } from './icons'
import { Link } from '../primitives/link'
import { cn } from '../../utils/cn'

export function NotFound({ className }: { className?: string }) {
  return (
    <div className={cn('bdocs-not-found', className)}>
      <div className="bdocs-not-found__panel">
        <span className="bdocs-not-found__code">404</span>
        <div className="bdocs-not-found__text">
          <h1 className="bdocs-not-found__title">Page Not Found</h1>
          <p className="bdocs-not-found__body">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link href="/" className="bdocs-not-found__action">
          <ArrowLeft size={14} /> Go to Home
        </Link>
      </div>
    </div>
  )
}
