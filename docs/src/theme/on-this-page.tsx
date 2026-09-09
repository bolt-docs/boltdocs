import { OnThisPage as OTP } from 'boltdocs/primitives'
import { useRoutes, type OnThisPageProps } from 'boltdocs/client'
import { Pencil, CircleHelp, TextAlignStart } from 'lucide-react'
import { CopyMarkdown } from '@/theme/copy-markdown'

export function OnThisPage({
  headings = [],
  editLink,
  communityHelp,
  filePath,
}: OnThisPageProps) {
  const { currentRoute } = useRoutes()
  // Reserve no space when there is nothing to show (e.g. collection pages),
  // so the content column stays centered in the viewport.
  if (headings.length === 0) {
    return null
  }

  return (
    <OTP.Root className="sticky top-navbar hidden xl:flex flex-col shrink-0 w-toc mr-10 py-4 pl-6 pr-4">
      <OTP.Header className="flex flex-row items-center gap-x-2 mb-5 text-sm font-semibold text-body">
        <TextAlignStart size={16} />
        On this page
      </OTP.Header>

      <OTP.Tree
        className="space-y-0.5 text-sm border-l border-subtle pb-5 px-5"
        contentClassName="max-h-75"
        itemClassName="data-[level=3]:pl-3"
        linkClassName="block py-0.5 pl-4 text-[13px] outline-none transition-colors text-muted hover:text-body data-active:text-body data-active:font-medium"
        indicatorClassName="-left-px w-0.5 rounded-full bg-body"
        fadeClassName="bg-linear-to-b from-transparent to-main"
        headings={headings}
      />

      {(editLink || communityHelp) && (
        <div className="mt-8 pt-8 space-y-4">
          <p className="text-sm font-bold text-body">Need help?</p>
          <ul className="space-y-3 mt-2">
            {editLink && filePath && (
              <li>
                <a
                  href={editLink.replace(':path', filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors"
                >
                  <Pencil size={12} />
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
      <CopyMarkdown mdxRaw={currentRoute?._rawContent} route={currentRoute} />
    </OTP.Root>
  )
}
