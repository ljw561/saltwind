import { defineCollection, z } from 'astro:content';

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  heroImage: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  type: 'content',
  schema: blogSchema,
});

const blogEn = defineCollection({
  type: 'content',
  schema: blogSchema,
});

export const collections = { blog, 'blog-en': blogEn };
