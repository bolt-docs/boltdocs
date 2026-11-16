import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'

function project(post: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bolt-mig-blog-'))
  fs.mkdirSync(path.join(root, 'blog'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
  )
  fs.writeFileSync(
    path.join(root, 'docusaurus.config.js'),
    "module.exports = { title: 'Blog site' }",
  )
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'docs', 'intro.md'),
    '---\ntitle: Intro\n---\nHi',
  )
  fs.writeFileSync(path.join(root, 'blog', 'post.md'), post)
  return root
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

function postPath(root: string): string {
  return path.join(root, 'docs', '[blog]', 'post.md')
}

describe('Docusaurus blog migration', () => {
  it('maps an inline author object to Boltdocs author', () => {
    const root = project(
      [
        '---',
        'title: Post',
        "authors: { name: 'Jesús', url: 'https://example.com', image_url: '/avatar.png' }",
        "image: '/cover.png'",
        'tags: [news, release]',
        '---',
        'Body',
      ].join('\n'),
    )
    migrate({ root, apply: true })
    const out = read(postPath(root))
    expect(out).toContain(
      'author: { name: "Jesús", avatar: "/avatar.png", url: "https://example.com" }',
    )
    expect(out).toContain("coverImage: '/cover.png'")
    expect(out).toContain('tags: [news, release]')
    expect(out).not.toContain('authors:')
    expect(out).not.toContain('image:')
  })

  it('reports author lists as manual', () => {
    const root = project('---\ntitle: Post\nauthors: [alice, bob]\n---\nBody')
    const plan = migrate({ root, apply: true })
    expect(
      plan.findings.some(
        (f) =>
          f.id === 'docusaurus/blog-note' &&
          f.detail.includes('list or a set of author ids'),
      ),
    ).toBe(true)
    expect(read(postPath(root))).toContain('authors: [alice, bob]')
  })

  it('reports YAML aliases in authors as manual', () => {
    const root = project('---\ntitle: Post\nauthors: &alice alice\n---\nBody')
    const plan = migrate({ root, apply: true })
    expect(
      plan.findings.some(
        (f) =>
          f.id === 'docusaurus/blog-note' &&
          f.detail.includes('YAML alias or anchor'),
      ),
    ).toBe(true)
  })

  it('reports the truncate marker as manual', () => {
    const root = project(
      '---\ntitle: Post\n---\nIntro text\n<!--truncate-->\nRest of post',
    )
    const plan = migrate({ root, apply: true })
    expect(
      plan.findings.some(
        (f) =>
          f.id === 'docusaurus/blog-note' &&
          f.detail.includes('<!--truncate-->'),
      ),
    ).toBe(true)
    expect(read(postPath(root))).toContain('<!--truncate-->')
  })

  it('maps a plain author string and keeps the post body', () => {
    const root = project('---\ntitle: Post\nauthors: Jesús\n---\nBody')
    migrate({ root, apply: true })
    const out = read(postPath(root))
    expect(out).toContain('author: Jesús')
    expect(out).toContain('Body')
  })
})
