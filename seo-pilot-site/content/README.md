# Content folder

Source-of-truth for case studies and blog posts. Push to Contentful with:

```bash
npm run push-content                                # everything
npm run push-content -- --type=case-study           # only case studies
npm run push-content -- --slug=jac-interiors-...    # one entry
npm run push-content -- --dry-run                   # parse + validate only
npm run push-content -- --draft                     # do not publish
```

Required env (`.env`):

```
CONTENTFUL_SPACE_ID=...
CONTENTFUL_MANAGEMENT_TOKEN=...        # Settings → API keys → Content management tokens
```

## File format

YAML frontmatter for simple fields. Markdown body split by `## SectionName` headings,
each one becoming a Rich Text field in Contentful.

### Case study sections → Contentful field IDs

| Markdown heading | Contentful field |
|---|---|
| `## Challenge` | `challenge` |
| `## Strategy` | `strategy` |
| `## Result` (or `## Results`) | `result` |
| `## Purpose` | `purpose` |

Inside each section, use `### Sub-heading` for sub-points — they render as h3 in Contentful.

### Blog post sections

| Markdown heading | Contentful field |
|---|---|
| `## Content` | `content` |
| `## FAQs` | `faqs` |

## Idempotency

The script looks up each entry by its `slug` (or `adminSlug` for case studies). If found,
it **overwrites** the entry from the markdown. If not, it creates it. SEO components
are matched by `canonicalUrl`. So you can re-run the push as many times as you want —
no duplicates.

## Images (deferred)

V1 doesn't upload images. Add `featuredImage` and `shareImages` in the Contentful UI
after the entry exists.
