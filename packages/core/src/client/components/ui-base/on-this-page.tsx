import { OnThisPage as OTP } from '../primitives/on-this-page'
import type { OnThisPageProps } from '../../types'
import { Pencil, CircleHelp, TextAlignStart } from './icons'

export function OnThisPage({
  headings = [],
  editLink,
  communityHelp,
  filePath,
}: OnThisPageProps) {
  if (headings.length === 0) return null

  return (
    <OTP.Root>
      <OTP.Header className="flex flex-row gap-x-2">
        <TextAlignStart size={16} />
        On this page
      </OTP.Header>

      <OTP.Tree headings={headings} />

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
