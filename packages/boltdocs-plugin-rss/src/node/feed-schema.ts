import { z } from 'zod'

export const RssPluginOptionsSchema = z.object({
  limit: z.number().min(1).max(500).optional(),
  paths: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  format: z.enum(['rss', 'atom', 'both']).default('rss').optional(),
  devMode: z.boolean().default(false).optional(),
})

export type RssPluginOptions = z.infer<typeof RssPluginOptionsSchema>
