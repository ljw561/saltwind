/**
 * Single source of truth for tag <-> slug <-> display-name mappings.
 *
 * This table used to be copy-pasted into six different files (TagList.astro,
 * tags/index.astro, tags/[tag].astro, en/tags/index.astro, en/tags/[tag].astro,
 * topics/[topic].astro). One of those copies going stale already caused a
 * Cloudflare build failure once. Do not re-declare a tag/slug/display-name
 * mapping anywhere else in the codebase — extend TAGS below instead.
 *
 * Tags that have no entry here (free-form tags like "Tabasco" or
 * "vacuum-bag") are left as-is: every helper falls back to treating the raw
 * tag string as its own slug/display name, matching the previous behavior.
 */

export interface TagDefinition {
  /** URL slug, e.g. 'fermentation' */
  slug: string;
  /** Chinese display name, e.g. '發酵' */
  zh: string;
  /** English display name, e.g. 'Fermentation' */
  en: string;
}

export const TAGS: TagDefinition[] = [
  { slug: 'life', zh: '生活', en: 'Life' },
  { slug: 'making', zh: '製作', en: 'Making' },
  { slug: 'obj', zh: '物件', en: 'Objects' },
  { slug: 'fermentation', zh: '發酵', en: 'Fermentation' },
  { slug: 'aging', zh: '熟成', en: 'Aging' },
  { slug: 'charcuterie', zh: '熟肉', en: 'Charcuterie' },
  { slug: 'bread', zh: '麵包', en: 'Bread' },
  { slug: 'coffee', zh: '咖啡', en: 'Coffee' },
  { slug: 'fish', zh: '魚', en: 'Fish' },
  { slug: 'pork', zh: '豬肉', en: 'Pork' },
  { slug: 'sausage', zh: '香腸', en: 'Sausage' },
  { slug: 'recipe', zh: '食譜', en: 'Recipe' },
  { slug: 'equipment', zh: '器具', en: 'Equipment' },
  { slug: 'taiwan', zh: '台灣', en: 'Taiwan' },
];

/** Look up a tag definition by its URL slug. */
export function findTagBySlug(slug: string): TagDefinition | undefined {
  return TAGS.find((t) => t.slug === slug);
}

/**
 * Resolve a raw post tag (Chinese display name, or an already-slug-shaped
 * English tag) to its URL slug. Unknown tags pass through unchanged.
 */
export function getTagSlug(tag: string): string {
  const match = TAGS.find((t) => t.zh === tag);
  return match ? match.slug : tag;
}

/**
 * Resolve a URL slug to its display name in the given language.
 * Unknown slugs pass through unchanged.
 */
export function getTagDisplayName(slug: string, lang: 'zh' | 'en'): string {
  const match = findTagBySlug(slug);
  if (!match) return slug;
  return lang === 'en' ? match.en : match.zh;
}

/**
 * Given a URL slug, return every raw tag string (as stored in post
 * frontmatter, in either collection) that should be grouped under it: the
 * slug itself, plus its Chinese and English display names when known.
 */
export function getTagsForSlug(slug: string): string[] {
  const match = findTagBySlug(slug);
  if (!match) return [slug];
  return [...new Set([slug, match.zh, match.en])];
}
