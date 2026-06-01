import { z } from 'zod'

/**
 * Schema for strict frontmatter validation.
 */
export const FrontmatterSchema = z.looseObject({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  permalink: z.string().optional(),
  sidebarPosition: z.number().optional(),
  sidebarLabel: z.string().max(100).optional(),
  sidebarHidden: z.boolean().optional(),
  hidden: z.boolean().optional(),
  category: z.string().max(50).optional(),
  order: z.number().optional(),
  badge: z
    .union([
      z.string().max(50),
      z.object({
        text: z.string().max(50),
        expires: z.string().optional(),
      }),
    ])
    .optional(),
  icon: z.string().max(50).optional(),
  date: z.union([z.string(), z.date()]).optional(),
  lastUpdated: z.union([z.string(), z.date()]).optional(),
  groupTitle: z.string().max(100).optional(),
  groupPosition: z.number().optional(),
  seo: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string().max(50)).optional(),
  author: z
    .union([
      z.string().max(100),
      z.object({
        name: z.string().max(100),
        avatar: z.string().optional(),
        url: z.string().optional(),
        image: z.string().optional(),
      }),
    ])
    .optional(),
  draft: z.boolean().optional(),
  excerpt: z.string().max(500).optional(),
  coverImage: z.string().nullable().optional(),
})

export type FrontmatterData = z.infer<typeof FrontmatterSchema>
