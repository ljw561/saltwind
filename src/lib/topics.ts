import { getCollection, type CollectionEntry } from 'astro:content';
import { topics, tagToTopics, type TopicConfig } from './topicMap';

type BlogPost = CollectionEntry<'blog'> | CollectionEntry<'blog-en'>;

/**
 * Check if a post belongs to a topic based on its tags.
 * A post belongs to a topic if ANY of its tags match the topic's tag list.
 * Uses tagsEn for English collection, tags for Chinese collection.
 */
export function postBelongsToTopic(
  post: BlogPost,
  topicSlug: string,
  collection: 'blog' | 'blog-en' = 'blog'
): boolean {
  const topic = topics.find((t) => t.slug === topicSlug);
  if (!topic) return false;

  const postTags = post.data.tags || [];
  const topicTags = collection === 'blog-en' ? topic.tagsEn : topic.tags;
  return postTags.some((tag) => topicTags.includes(tag));
}

/**
 * Get all posts belonging to a specific topic.
 * Sorted by pubDate (newest first).
 */
export async function getPostsByTopic(
  topicSlug: string,
  collection: 'blog' | 'blog-en' = 'blog'
): Promise<BlogPost[]> {
  const allPosts = await getCollection(collection, ({ data }) => !data.draft);

  const filtered = allPosts.filter((post) => postBelongsToTopic(post, topicSlug, collection));

  return filtered.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Get post counts for all topics.
 * Returns a map of topic slug -> post count.
 */
export async function getTopicPostCounts(
  collection: 'blog' | 'blog-en' = 'blog'
): Promise<Record<string, number>> {
  const allPosts = await getCollection(collection, ({ data }) => !data.draft);

  const counts: Record<string, number> = {};

  topics.forEach((topic) => {
    counts[topic.slug] = allPosts.filter((post) =>
      postBelongsToTopic(post, topic.slug, collection)
    ).length;
  });

  return counts;
}

/**
 * Get popular tags within a topic (for navigation).
 * Returns tags sorted by frequency, limited to top N.
 */
export async function getPopularTagsInTopic(
  topicSlug: string,
  collection: 'blog' | 'blog-en' = 'blog',
  limit: number = 8
): Promise<{ tag: string; count: number }[]> {
  const posts = await getPostsByTopic(topicSlug, collection);

  const tagCounts: Record<string, number> = {};

  posts.forEach((post) => {
    (post.data.tags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get all topics with their configs.
 */
export function getAllTopics(): TopicConfig[] {
  return topics;
}
