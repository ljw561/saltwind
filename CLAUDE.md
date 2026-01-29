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

### 2. Image Handling
- Use `<figure>` tags for images in MDX content
- Always include `loading="lazy"` for performance
- Images automatically adapt via CSS (`max-width: 100%`, `height: auto`)
- Provide meaningful `alt` text for accessibility

### 3. Auto Push to GitHub
- After completing any changes, automatically run:
  1. `npm run build` - Verify build succeeds
  2. `git add <changed-files>` - Stage specific files (not `.claude/` or local settings)
  3. `git commit` - Create commit with descriptive message
  4. `git push` - Push to GitHub

### 4. Tag System
- Tag mapping is defined in `src/pages/tags/[tag].astro`
- Current mappings: `生活` → `life`, `製作` → `making`, `物件` → `obj`
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
tags: ["物件"]
---
```

English (`src/content/blog-en/2026-01-28XX.mdx`):
```yaml
---
title: "Article Title"
description: "Article description"
pubDate: 2026-01-28
tags: ["obj"]
---
```

### 6. Paragraph Spacing (Reading Flow)
All blog posts must have proper "breathing room" between paragraphs for comfortable reading:

#### Principles
- **One idea, one paragraph** — each independent thought should be its own paragraph
- **Break long sentences** — split lengthy passages to create natural pause points
- **Space before transitions** — add a blank line before words like「但」「然而」「不過」(but, however)
- **Space after key statements** — important conclusions deserve their own line

#### Formatting Rules
- Use single blank lines between regular paragraphs
- Use `---` (horizontal rule) to separate major sections
- Lists and blockquotes should have blank lines before and after
- Don't let two consecutive lines form a wall of text

#### Example
```markdown
在德國，「獵人香腸」並不是靠重煙或強烈香料取勝。

真正的獵人風味，來自於脂肪被妥善整理、香氣乾淨而克制。

這份配方刻意不使用煙燻，改由杜松子建立森林感。
```

NOT:
```markdown
在德國，「獵人香腸」並不是靠重煙或強烈香料取勝。
真正的獵人風味，來自於脂肪被妥善整理、香氣乾淨而克制。
這份配方刻意不使用煙燻，改由杜松子建立森林感。
```
