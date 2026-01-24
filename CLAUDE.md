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
