import { describe, it, expect } from 'vitest'
import { SEOValidateStep } from '../../src/node/pipeline/steps/seo-validate'
import type { BuildContext } from '../../src/node/pipeline/types'

describe('SEOValidateStep', () => {
  it('should enrich og:image and resolve relative urls using siteUrl', async () => {
    const step = new SEOValidateStep()
    const ctx: BuildContext = {
      root: '/fake/root',
      timing: {},
      config: {
        siteUrl: 'https://boltdocs.vercel.app/',
        seo: {
          thumbnails: {
            background: '/og-image.webp',
          },
        },
      },
      routes: [
        {
          path: '/blog/post-1',
          filePath: 'blog/post-1.mdx',
          title: 'Post 1',
          description: 'A blog post',
          coverImage: '/blog-covers/post-1.png',
        },
        {
          path: '/blog/post-2',
          filePath: 'blog/post-2.mdx',
          title: 'Post 2',
          description: 'Another blog post',
          // No coverImage, should fallback to config default
        },
        {
          path: '/blog/post-3',
          filePath: 'blog/post-3.mdx',
          title: 'Post 3',
          description: 'Third post',
          seo: {
            'og:image': 'https://external.com/custom.jpg', // Already absolute URL, should not be modified
          },
        },
      ],
    }

    await step.execute(ctx)

    expect(ctx.routes![0].seo).toBeDefined()
    expect(ctx.routes![0].seo!['og:image']).toBe(
      'https://boltdocs.vercel.app/blog-covers/post-1.png',
    )

    expect(ctx.routes![1].seo).toBeDefined()
    expect(ctx.routes![1].seo!['og:image']).toBe(
      'https://boltdocs.vercel.app/og-image.webp',
    )

    expect(ctx.routes![2].seo).toBeDefined()
    expect(ctx.routes![2].seo!['og:image']).toBe(
      'https://external.com/custom.jpg',
    )
  })
})
