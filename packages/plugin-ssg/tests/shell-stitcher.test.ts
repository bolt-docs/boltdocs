import { describe, it, expect } from 'vitest'
import { ShellStitcher, type ShellSlots } from '../src/node/shell-stitcher'

describe('ShellStitcher', () => {
  const template = [
    '<html>',
    '  <head>',
    '    <!--BDOCS_SLOT:TITLE-->',
    '    <!--BDOCS_SLOT:META-->',
    '  </head>',
    '  <body>',
    '    <!--BDOCS_SLOT:BREADCRUMBS-->',
    '    <!--BDOCS_SLOT:CONTENT-->',
    '    <!--BDOCS_SLOT:TOC-->',
    '    <!--BDOCS_SLOT:PAGENAV-->',
    '  </body>',
    '</html>',
  ].join('\n')

  const newStitcher = () => new ShellStitcher({ template })

  it('injects content into the CONTENT slot', () => {
    const out = newStitcher().stitch({ content: '<main>Hello</main>' })
    expect(out).toContain('<main>Hello</main>')
    expect(out).not.toContain('<!--BDOCS_SLOT:CONTENT-->')
  })

  it('injects title, meta, toc, breadcrumbs and pageNav slots', () => {
    const slots: ShellSlots = {
      title: 'My Docs',
      meta: '<meta name="description" content="x">',
      toc: '<ul><li>Intro</li></ul>',
      breadcrumbs: '<nav>Home / Guide</nav>',
      pageNav: '<a href="#">Next</a>',
      content: '<p>Body</p>',
    }
    const out = newStitcher().stitch(slots)
    expect(out).toContain('My Docs')
    expect(out).toContain('Home / Guide')
    expect(out).toContain('<a href="#">Next</a>')
    expect(out).toContain('<p>Body</p>')
    for (const marker of [
      '<!--BDOCS_SLOT:TITLE-->',
      '<!--BDOCS_SLOT:META-->',
      '<!--BDOCS_SLOT:TOC-->',
      '<!--BDOCS_SLOT:BREADCRUMBS-->',
      '<!--BDOCS_SLOT:PAGENAV-->',
    ]) {
      expect(out).not.toContain(marker)
    }
  })

  it('leaves missing slots untouched', () => {
    const out = newStitcher().stitch({ content: '<p>Hi</p>' })
    expect(out).toContain('<!--BDOCS_SLOT:TITLE-->')
    expect(out).toContain('<!--BDOCS_SLOT:META-->')
    expect(out).not.toContain('<!--BDOCS_SLOT:CONTENT-->')
  })

  it('replaces every occurrence for repeated markers', () => {
    const tpl = [
      '<div>',
      '<!--BDOCS_SLOT:TITLE-->',
      '<!--BDOCS_SLOT:TITLE-->',
      '</div>',
    ].join('\n')
    const out = new ShellStitcher({ template: tpl }).stitch({ title: 'X' })
    expect(out.match(/X/g)).toHaveLength(2)
    expect(out).not.toContain('<!--BDOCS_SLOT:TITLE-->')
  })
})
