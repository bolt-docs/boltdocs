import { OnThisPage as OTP } from '../primitives/on-this-page'
import type { OnThisPageProps } from '../../types'
import { Pencil, CircleHelp, TextAlignStart } from './icons'
import { cn } from '../../utils/cn'

interface OnThisPageUIProps extends OnThisPageProps {
  className?: string
}

export function OnThisPage({
  headings = [],
  editLink,
  communityHelp,
  filePath,
  className,
}: OnThisPageUIProps) {
  if (headings.length === 0) {
    return (
      <nav
        className={cn('w-toc shrink-0 hidden xl:block', className)}
        aria-hidden="true"
      />
    )
  }

  return (
    <OTP.Root
      className={cn(
        'sticky top-navbar hidden xl:flex flex-col shrink-0 w-toc py-4 pl-6 pr-4',
        className,
      )}
    >
      <OTP.Header className="mb-4 text-xs font-bold text-body flex flex-row gap-x-2">
        <TextAlignStart size={16} />
        On this page
      </OTP.Header>

      <OTP.Tree
        className="space-y-0.5 text-sm border-l border-subtle"
        itemClassName="data-[level=3]:pl-3"
        linkClassName="block py-0.5 pl-4 text-[13px] outline-none transition-colors text-muted hover:text-body data-active:text-primary-500"
        indicatorClassName="-left-px w-0.5 rounded-full bg-primary-500"
        fadeClassName="bg-linear-to-b from-transparent to-main"
        headings={headings}
      />

      {(editLink || communityHelp) && (
        <div className="mt-8 pt-8 border-t border-subtle space-y-4">
          <p className="text-xs font-bold text-body">Need help?</p>
          <ul className="space-y-3">
            {editLink && filePath && (
              <li>
                <a
                  href={editLink.replace(':path', filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors"
                >
                  <Pencil size={16} />
                  Edit this page
                </a>
              </li>
            )}
            {communityHelp && (
              <li>
                <a
                  href={communityHelp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors"
                >
                  <CircleHelp size={16} />
                  Community help
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </OTP.Root>
  )
}
