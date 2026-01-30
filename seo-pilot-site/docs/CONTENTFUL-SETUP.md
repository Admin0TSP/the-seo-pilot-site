# Contentful setup (Page – Blog Post / Page – Case Study)

This project uses the **composition** architecture: pages reference reusable components (SEO, Content Block, Result Block). Content types below must match what the generator and Preview API expect.

## 1. Content type IDs (API identifiers)

In **Content model**, each content type has an **API identifier**. The code uses these defaults (override via env; see `.env.example`):

| Model | API ID | Env override |
|-------|--------|--------------|
| Page – Blog Post | `pageBlogPost` | `CONTENTFUL_BLOG_CONTENT_TYPE` |
| Page – Case Study | `caseStudyPage` | `CONTENTFUL_CASE_STUDY_CONTENT_TYPE` |
| Rich Content Block | `richContentBlock` | `CONTENTFUL_RICH_CONTENT_BLOCK_TYPE` |
| Result Block Component | `resultBlockComponent` | `CONTENTFUL_RESULT_BLOCK_TYPE` |
| Component – SEO | `seoComponent` | `CONTENTFUL_SEO_COMPONENT_TYPE` |
| Component – Author | `authorComponent` | `CONTENTFUL_AUTHOR_TYPE` |
| CTA Block | `ctaBlock` | `CONTENTFUL_CTA_BLOCK_TYPE` |
| Component – FAQ | `componentFaq` | `CONTENTFUL_FAQ_COMPONENT_TYPE` |
| Landing Page | `landingPage` | `CONTENTFUL_LANDING_PAGE_TYPE` |

## 2. Page – Blog Post

| Field | Type | Required | API ID (example) |
|-------|------|----------|------------------|
| Internal name | Short text | ✓ | `internalName` |
| Slug | Short text | ✓ | `slug` |
| Title | Short text | ✓ | `title` |
| Subtitle | Short text | ❌ | `subtitle` |
| Author | Reference → Author | ❌ | `author` |
| Published date | Date | ✓ | `publishedDate` |
| Featured image | Media | ❌ | `featuredImage` |
| Content blocks | Reference (many) → Rich Content Block, CTA Block | ✓ | `contentBlocks` (or `content_blocks`, `blocks`, `sections`) |
| Related blog posts | Reference (many) | ❌ | `relatedBlogPosts` |
| FAQs | Reference (many) → **Component – FAQ** | ❌ | `faqs` |
| SEO fields | Reference → **Component – SEO** | ✓ | `seoFields` or `seo` |

**URLs:** `/resources/blog/{slug}/`

## 3. Page – Case Study

| Field | Type | Required | API ID (example) |
|-------|------|----------|------------------|
| Internal name | Short text | ✓ | `internalName` |
| Slug | Short text | ✓ | `slug` |
| Client name | Short text | ✓ | `clientName` |
| Industry | Short text | ❌ | `industry` |
| Timeframe | Short text | ❌ | `timeframe` |
| Challenge | Long text | ✓ | `challenge` |
| Strategy | Rich text | ✓ | `strategy` |
| Results blocks | Reference (many) → **Result Block** | ✓ | `resultsBlocks` |
| Key metrics | JSON / Long text | ❌ | `keyMetrics` |
| Featured image | Media | ❌ | `featuredImage` |
| SEO fields | Reference → **Component – SEO** | ✓ | `seoFields` or `seo` |

**URLs:** `/resources/case-studies/{slug}/`

The **Aspora** case study is static at `/resources/case-studies/aspora-ai-visibility/`. Add others in Contentful; the generator will create their pages.

## 4. Component – SEO

Referenced by every page. API ID: `seoComponent`.

| Field | Type | API ID (example) |
|-------|------|------------------|
| Page title | Short text | `pageTitle` |
| Page description | Long text | `pageDescription` |
| Canonical URL | Short text | `canonicalUrl` |
| noindex | Boolean | `noindex` |
| nofollow | Boolean | `nofollow` |
| Share images | Media (many) | `shareImages` |

## 5. Component – Content Block

Used in **Content blocks** (Page – Blog Post). API ID: `richContentBlock`. **CTA Block** (`ctaBlock`) can also be used in the same Reference (many) field; it is rendered as a styled CTA (heading, description, button).

| Field | Type | API ID (example) |
|-------|------|------------------|
| Block type | Dropdown: **text**, **image**, **quote**, **list**, **code** | `blockType` |
| Rich text | Rich text | `richText` (or `rich_text`, `body`, `content`) |
| Image | Media | `image` |
| Caption | Short text | `caption` |
| Full width | Boolean | `fullWidth` |

Block type values map to CSS classes (e.g. `content-block--text`, `content-block--quote`) for styling.

## 6. Component – Result Block

Used in **Results blocks** (Page – Case Study). API ID: `resultBlockComponent`.

| Field | Type | API ID (example) |
|-------|------|------------------|
| Metric label | Short text | `metricLabel` |
| Metric value | Short text | `metricValue` |
| Graph image | Media | `graphImage` |
| Description | Long text | `description` |

## 7. Component – FAQ

Used in **FAQs** (Page – Blog Post). API ID: `componentFaq`. Renders a styled FAQ section with JSON-LD FAQPage schema for SEO.

| Field | Type | API ID (example) |
|-------|------|------------------|
| Question | Short text | `question` |
| Answer | Rich text or Long text | `answer` |

## 8. Environment variables

```bash
CONTENTFUL_SPACE_ID=...
CONTENTFUL_ACCESS_TOKEN=...       # Delivery API (generate)
CONTENTFUL_PREVIEW_TOKEN=...     # Preview API (blog preview only)
# Optional overrides (see .env.example for all content model API IDs):
# CONTENTFUL_BLOG_CONTENT_TYPE=pageBlogPost
# CONTENTFUL_CASE_STUDY_CONTENT_TYPE=caseStudyPage
# CONTENTFUL_RICH_CONTENT_BLOCK_TYPE=richContentBlock
# ... etc.
```

- **Static site / generate:** `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`
- **Preview API** (Render Web Service): `CONTENTFUL_SPACE_ID`, `CONTENTFUL_PREVIEW_TOKEN`

## 9. Generate

```bash
npm install
npm run generate
```

- Fetches **Page – Blog Post** and **Page – Case Study** with `include=5` (resolves SEO, content blocks, CTA blocks, result blocks, assets).
- Set `CONTENTFUL_DEBUG=1` when running `npm run generate` to log block-resolution warnings if content is missing.
- Outputs `resources/blog/index.html`, `resources/blog/{slug}/index.html`, `resources/case-studies/index.html`, `resources/case-studies/{slug}/index.html`.
- If env is missing, the script skips without changing files.

## 10. Blog preview

1. Deploy the **Preview API** (`preview-api/`) as a Render Web Service.
2. **Contentful → Settings → Content preview:** set Preview URL for **Page – Blog Post** to  
   `https://www.theseopilot.pro/blog-preview?slug={{entry.fields.slug}}`
3. Set `window.PREVIEW_API_BASE` in `blog-preview/config.js` to your Preview API URL.

See **docs/PREVIEW-SETUP.md**.

## 11. Aspora graph

Add the GSC growth graph as `assets/img/case-studies/aspora-gsc-growth.png`. See `assets/img/case-studies/README.md`.
