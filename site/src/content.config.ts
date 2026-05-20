/**
 * Content Collections schema (Astro 6+).
 * Source de verdad para el blog programático: validado en build time con Zod.
 * Los archivos viven en src/content/blog/<lang>/<slug>.md
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogSchema = z.object({
  title: z.string().min(10).max(120),
  description: z.string().min(80).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  lang: z.enum(['es', 'en']),
  language_alternate: z.string().optional(), // slug del post equivalente en el otro idioma

  date_published: z.coerce.date(),
  date_updated: z.coerce.date().optional(),

  author: z.string().default('Equipo Casa Museo Laureles'),
  tags: z.array(z.string()).default([]),

  primary_keyword: z.string(),
  secondary_keywords: z.array(z.string()).default([]),

  hero_image: z.string().optional(),
  hero_alt: z.string().optional(),
  hero_credit: z.string().optional(),

  faq: z.array(z.object({
    q: z.string(),
    a: z.string(),
  })).default([]),

  internal_links: z.array(z.object({
    url: z.string(),
    anchor: z.string(),
  })).default([]),

  external_sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
  })).default([]),

  // Validation flags (set by content-draft-generator skill)
  brain_generated: z.boolean().default(false),
  brain_run_id: z.string().optional(),
  validated_by_geo_rules: z.boolean().default(false),
  draft: z.boolean().default(true), // true = no publicar todavía, false = publicar
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: blogSchema,
});

export const collections = { blog };
