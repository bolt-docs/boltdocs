/**
 * Shell Stitcher — Fast template interpolation engine for SSG Layout Shells.
 *
 * Replaces <!--BDOCS_SLOT:*--> markers in pre-rendered shell templates with
 * page-specific fragments (MDX content, TOC, meta tags, breadcrumbs, page nav).
 *
 * This decouples the SSG build engine from specific React theme components,
 * enabling headless theme extraction (e.g. moving ui-base/primitives to external themes).
 */

export interface ShellSlots {
  content: string
  toc?: string
  meta?: string
  breadcrumbs?: string
  pageNav?: string
  title?: string
}

export interface ShellStitcherOptions {
  /** Pre-rendered HTML template with <!--BDOCS_SLOT:*--> markers */
  template: string
}

export class ShellStitcher {
  private readonly template: string

  constructor(options: ShellStitcherOptions) {
    this.template = options.template
  }

  /**
   * Inject page fragments into template slot markers.
   */
  stitch(slots: ShellSlots): string {
    let result = this.template

    if (slots.content !== undefined) {
      result = result.replace(/<!--BDOCS_SLOT:CONTENT-->/g, slots.content)
    }

    if (slots.toc !== undefined) {
      result = result.replace(/<!--BDOCS_SLOT:TOC-->/g, slots.toc)
    }

    if (slots.meta !== undefined) {
      result = result.replace(/<!--BDOCS_SLOT:META-->/g, slots.meta)
    }

    if (slots.breadcrumbs !== undefined) {
      result = result.replace(
        /<!--BDOCS_SLOT:BREADCRUMBS-->/g,
        slots.breadcrumbs,
      )
    }

    if (slots.pageNav !== undefined) {
      result = result.replace(/<!--BDOCS_SLOT:PAGENAV-->/g, slots.pageNav)
    }

    if (slots.title !== undefined) {
      result = result.replace(/<!--BDOCS_SLOT:TITLE-->/g, slots.title)
    }

    return result
  }
}
