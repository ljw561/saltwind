# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saltwind - A static blog/content site built with Astro and Tailwind CSS.

## Build Commands

```bash
npm run dev      # Start dev server (localhost:4321)
npm run build    # Build for production
npm run preview  # Preview production build
npm run astro    # Run Astro CLI commands
```

## Test Commands

```bash
npm run build    # Build validates content schemas and pages
```

## Architecture

### Tech Stack
- **Framework**: Astro 4.x
- **Styling**: Tailwind CSS 4.x
- **Content**: Astro Content Collections (MDX)
- **Package Manager**: npm

### Project Structure
```
src/
├── components/        # Reusable UI components (Header, Footer, PostCard, etc.)
├── content/
│   ├── config.ts      # Content collection schemas
│   └── blog/          # Blog posts (MDX files)
├── layouts/
│   ├── BaseLayout.astro
│   └── PostLayout.astro
├── pages/
│   ├── index.astro    # Homepage
│   ├── blog/          # Blog listing and post pages
│   ├── tags/          # Tag listing and filtered posts
│   ├── about.astro
│   └── rss.xml.ts     # RSS feed
└── styles/
    └── global.css     # Tailwind directives + custom styles
```

### Key Features
- Content Collections with type-safe frontmatter
- MDX support for rich content
- Dark mode with localStorage persistence
- SEO optimized (Open Graph, meta tags)
- RSS feed
- Tags system for content organization

## Workflow Rules

Every update to this project MUST follow these rules:

### 1. Responsive Design
- All layouts must adapt to desktop, tablet, and mobile devices
- Test builds to ensure proper rendering across different screen sizes
- Use Tailwind responsive prefixes (sm:, md:, lg:) when needed

### 2. Image Handling (Cross-Browser Compatible)
- Use `<figure>` tags for images in MDX content
- Provide meaningful `alt` text for accessibility
- Images automatically adapt via CSS (`max-width: 100%`, `height: auto`)

#### Required Attributes for Cross-Browser Compatibility
Every `<img>` tag MUST include these attributes:
- `loading="lazy"` — deferred loading for performance
- `decoding="async"` — non-blocking image decoding (Safari, Chrome, Firefox)

#### Standard Image Format
```html
<figure>
  <img
    src="IMAGE_URL"
    alt="描述文字"
    loading="lazy"
    decoding="async"
  />
  <figcaption>圖說文字</figcaption>
</figure>
```

#### Why These Attributes Matter
- `loading="lazy"`: Delays loading off-screen images (supported in all modern browsers)
- `decoding="async"`: Prevents image decoding from blocking the main thread, improves page responsiveness across Chrome, Firefox, Safari, and Edge

### 3. Auto Push to GitHub
- After completing any changes, automatically run:
  1. `npm run build` - Verify build succeeds
  2. `git add <changed-files>` - Stage specific files (not `.claude/` or local settings)
  3. `git commit` - Create commit with descriptive message
  4. `git push` - Push to GitHub

### 4. Tag System

#### Main Categories (REQUIRED)
Every blog post MUST include exactly ONE of these three main categories as the FIRST tag:

| Chinese | English | Description |
|---------|---------|-------------|
| 生活 | life | 瑣碎、雜事、日常想法、分析觀點 |
| 製作 | making | 實驗中、過程紀錄、製作筆記 |
| 物件 | obj | 做完了、能用、附做法或完整指南 |

#### Tag Mapping
- Tag mapping is defined in `src/pages/tags/[tag].astro`
- Main category mappings: `生活` → `life`, `製作` → `making`, `物件` → `obj`
- Both display name and URL slug are handled automatically

### 5. Bilingual Content (Chinese + English)
When adding a new blog post, ALWAYS create both Chinese and English versions:

#### File Structure
- Chinese: `src/content/blog/YYYY-MM-DDXX.mdx`
- English: `src/content/blog-en/YYYY-MM-DDXX.mdx`
- **File names must be identical** between Chinese and English versions

#### Translation Guidelines
- Use casual, conversational English — avoid fancy or uncommon words
- Keep the same structure and meaning as the Chinese version
- Translate image `alt` text and `figcaption` content
- Update internal links to point to the correct language version:
  - Chinese article links: `/blog/...`
  - English article links: `/en/blog/...`

#### Tag Mapping (English)
- `life` → "Life"
- `making` → "Making"
- `obj` → "Objects"

#### Example Frontmatter
Chinese (`src/content/blog/2026-01-28XX.mdx`):
```yaml
---
title: "文章標題"
description: "文章描述"
pubDate: 2026-01-28
heroImage: "https://example.com/image.jpg"  # optional
heroWidth: 1200   # optional: for CLS prevention
heroHeight: 800   # optional: for CLS prevention
tags: ["物件", "其他標籤"]  # 主分類必須放第一個
---
```

English (`src/content/blog-en/2026-01-28XX.mdx`):
```yaml
---
title: "Article Title"
description: "Article description"
pubDate: 2026-01-28
heroImage: "https://example.com/image.jpg"  # optional
heroWidth: 1200   # optional: for CLS prevention
heroHeight: 800   # optional: for CLS prevention
tags: ["obj", "other-tag"]  # Main category must be first
---
```

#### Hero Image Guidelines
- `heroWidth` and `heroHeight` are optional but recommended for CLS prevention
- If provided, they set the aspect-ratio to reserve space before image loads
- Portrait images will display naturally (not cropped into 16:9)
- Maximum height is 70vh to prevent overly tall images on desktop

### 6. Paragraph Spacing (Reading Flow)
All blog posts must have proper "breathing room" between paragraphs for comfortable reading.

**Goal: Give readers space to breathe. Every paragraph should feel like its own moment.**

#### Principles
- **One idea, one paragraph** — each independent thought should be its own paragraph
- **Break long sentences** — if a sentence has two parts connected by a comma, consider splitting them
- **Space before transitions** — add a blank line before words like「但」「然而」「不過」「這意味著」(but, however, this means)
- **Space after key statements** — important conclusions deserve their own line
- **Maximum 2-3 sentences per paragraph** — if longer, find a natural break point

#### Formatting Rules
- Use single blank lines between ALL paragraphs (no exceptions)
- Use `---` (horizontal rule) to separate major topic shifts or before conclusions
- Lists and blockquotes should have blank lines before and after
- Never let two consecutive lines form a wall of text
- After a colon (：), consider whether the following content should be a new paragraph

#### When to Use Horizontal Rules (`---`)
- Before a major conclusion or summary
- When shifting from explanation to personal opinion
- Before "延伸閱讀" or "Related Reading" sections
- Between distinct phases in a process (e.g., in recipes)

#### Example (Good)
```markdown
這次處理的是一尾約 4 斤重的真鯛。

我選擇給它完整熟成 7 天，不是為了追求誇張的風味轉變，而是讓肉質「安靜下來」。

把原本緊繃的纖維，慢慢鬆解成更細緻、甜感更清楚的狀態。

這一尾魚，沒有任何一個部位被浪費。
```

#### Example (Bad - too dense)
```markdown
這次處理的是一尾約 4 斤重的真鯛。我選擇給它完整熟成 7 天，不是為了追求誇張的風味轉變，而是讓肉質「安靜下來」，把原本緊繃的纖維，慢慢鬆解成更細緻、甜感更清楚的狀態。這一尾魚，沒有任何一個部位被浪費。
```

### 7. Related Posts (Automatic)
Every blog post automatically displays a "延伸閱讀" (Related Posts) section at the end.

#### How It Works
- **Built at build time (SSG)** — no runtime overhead
- **Ranking algorithm**:
  1. Tag intersection count (more shared tags = higher priority)
  2. Title keyword similarity (fallback when no tag matches)
  3. Publication date (newer first, as tie-breaker)
- **Displays 6 posts** by default, excludes current article
- **SEO-friendly** — outputs standard `<a href>` links crawlable by search engines

#### Implementation
- Component: `src/components/RelatedPosts.astro`
- Integrated in: `src/layouts/PostLayout.astro`
- Supports both `blog` (Chinese) and `blog-en` (English) collections

#### No Manual Action Required
This feature is automatic. When you add a new blog post:
- It will appear in other posts' related sections (if relevant)
- It will show its own related posts at the bottom
