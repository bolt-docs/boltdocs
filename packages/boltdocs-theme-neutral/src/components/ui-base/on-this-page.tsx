import { OnThisPage as OTP } from '../composition/on-this-page'
import type { OnThisPageProps } from '@bdocs/runtime'
import { cn } from '../../utils/cn'
import { Pencil, CircleHelp, TextAlignStart } from './icons'

interface OnThisPageUIProps extends OnThisPageProps {
  className?: string
}

/**
 * The default look for the table of contents.
 *
 * Everything visible — the rail's width and stickiness, the header, the
 * indentation that encodes heading depth, the active-entry colour and its track
 * — is in `styles/components/on-this-page.css`. This component contributes
 * structure and state, and the stylesheet reads that state from the `data-level`
 * and `data-active` attributes the composition layer already emits.
 *
 * The `data-level` conditional used to be a Tailwind arbitrary variant
 * (`data-[level=3]:pl-3`). Written as a plain attribute selector it now lives in
 * the same place as the numbering that sizes it, so changing the indent for
 * level 3 does not mean finding a variant alias for it.
 */
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
        className={cn('bdocs-toc__root bdocs-toc__root--empty', className)}
        aria-hidden="true"
      />
    )
  }

  return (
    <OTP.Root className={cn('bdocs-toc__root', className)}>
      <OTP.Header className="bdocs-toc__header">
        <TextAlignStart size={16} />
        On this page
      </OTP.Header>

      <OTP.Tree
        className="bdocs-toc__tree"
        itemClassName="bdocs-toc__item"
        linkClassName="bdocs-toc__link"
        indicatorClassName="bdocs-toc__indicator"
        fadeClassName="bdocs-toc__fade"
        headings={headings}
      />

      {(editLink || communityHelp) && (
        <div className="bdocs-toc__help">
          <p className="bdocs-toc__help-title">Need help?</p>
          <ul className="bdocs-toc__help-list">
            {editLink && filePath && (
              <li>
                <a
                  href={editLink.replace(':path', filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bdocs-toc__help-link"
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
                  className="bdocs-toc__help-link"
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
