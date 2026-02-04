/**
 * Topic Cluster Mapping
 *
 * Maps tags to SEO topic clusters.
 * Each topic has:
 * - slug: URL path segment
 * - title: Display name (Chinese)
 * - titleEn: Display name (English)
 * - description: Short intro for SEO
 * - tags: Array of tags that belong to this topic
 */

export interface TopicConfig {
  slug: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  tags: string[];      // Chinese tags
  tagsEn: string[];    // English tags
}

export const topics: TopicConfig[] = [
  {
    slug: 'fermentation',
    title: '發酵與保存科學',
    titleEn: 'Fermentation & Preservation',
    description: '從乳酸發酵到魚露釀造，探索微生物如何轉化食材風味。記錄各種發酵實驗的過程、失敗與成功。',
    descriptionEn: 'From lactic fermentation to fish sauce brewing, exploring how microbes transform flavors. Documenting fermentation experiments, failures, and successes.',
    tags: ['發酵', '辣椒', 'Tabasco', '乳酸發酵', '魚露', '自製調味料', '朝天椒', '白鱙魚'],
    tagsEn: ['fermentation', 'lactic-fermentation', 'fish-sauce', 'tabasco', 'chili', 'homemade-condiments', 'whitebait'],
  },
  {
    slug: 'cured-meat',
    title: '歐式熟肉與肉品工藝',
    titleEn: 'Charcuterie & Meat Craft',
    description: '風乾、鹽漬、熟成——從 Guanciale 到獵人香腸，在台灣環境下實踐歐式熟肉技術。',
    descriptionEn: 'Dry-curing, salt-curing, aging — practicing European charcuterie techniques in Taiwan, from Guanciale to hunter sausages.',
    tags: ['熟肉', '香腸', '熟成', '豬肉', 'charcuterie'],
    tagsEn: ['charcuterie', 'sausage', 'aging', 'pork'],
  },
  {
    slug: 'coffee-processing',
    title: '咖啡後製與加工實驗',
    titleEn: 'Coffee Processing & Experiments',
    description: '從生豆處理到烘焙，探索咖啡風味的各種可能性。厭氧發酵、日曬、水洗的實驗紀錄。',
    descriptionEn: 'From green bean processing to roasting, exploring coffee flavor possibilities. Documenting anaerobic fermentation, natural, and washed process experiments.',
    tags: ['咖啡'],
    tagsEn: ['coffee'],
  },
  {
    slug: 'food-tools',
    title: '食品設備與工具研究',
    titleEn: 'Food Equipment & Tools',
    description: '工欲善其事，必先利其器。記錄各種食品加工設備的使用心得與改裝經驗。',
    descriptionEn: 'Good tools make good work. Documenting experiences with food processing equipment and modifications.',
    tags: ['器具', '真空袋', '設備', '工具'],
    tagsEn: ['equipment', 'vacuum-bag', 'tools'],
  },
];

// Quick lookup: tag -> topic slugs (a tag can belong to multiple topics)
export const tagToTopics: Record<string, string[]> = {};

topics.forEach((topic) => {
  topic.tags.forEach((tag) => {
    if (!tagToTopics[tag]) {
      tagToTopics[tag] = [];
    }
    tagToTopics[tag].push(topic.slug);
  });
});

// Get topic config by slug
export function getTopicBySlug(slug: string): TopicConfig | undefined {
  return topics.find((t) => t.slug === slug);
}

// Get all topic slugs
export function getAllTopicSlugs(): string[] {
  return topics.map((t) => t.slug);
}
