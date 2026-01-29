# Contentful setup for Resources (blog + case studies)

## 1. Create a Contentful space

1. Go to [Contentful](https://www.contentful.com/) and create a space.
2. Get **Space ID** and **Content Delivery API – access token** from **Settings → API keys**.

## 2. Environment variables

Copy `.env.example` to `.env` and set:

```
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ACCESS_TOKEN=your_delivery_token
```

On **Render**, add the same vars in **Environment** for the static site.

## 3. Content models

### Blog Post (`blogPost`)

| Field | Type | Required |
|-------|------|----------|
| `title` | Short text | ✓ |
| `slug` | Short text | ✓ (unique, used in URL) |
| `excerpt` | Long text | |
| `body` or `content` | Long text (HTML) | ✓ |
| `publishDate` | Date & time | ✓ |
| `seoTitle` | Short text | |
| `seoDescription` | Long text | |

**URLs:** `/resources/blog/{slug}/`

### Case Study (`caseStudy`)

| Field | Type | Required |
|-------|------|----------|
| `title` | Short text | ✓ |
| `slug` | Short text | ✓ (unique) |
| `clientName` | Short text | |
| `killerMetric` | Short text | (e.g. "7.49M impressions in 6 months") |
| `challenge` | Long text | |
| `strategy` | Long text | |
| `results` | Long text (HTML allowed) | |
| `whyAICites` | Long text | |
| `graphImage1Url` | Short text | Optional. Full URL to graph image. |
| `graphImage2Url` | Short text | Optional. |

**URLs:** `/resources/case-studies/{slug}/`

The **Aspora** case study is static at `/resources/case-studies/aspora-ai-visibility/`. Add others in Contentful; the generator will create their pages and add them to the case studies listing.

## 4. Generate

```bash
npm install
npm run generate
```

- Reads from Contentful and overwrites:
  - `resources/blog/index.html`
  - `resources/blog/{slug}/index.html` for each post
  - `resources/case-studies/index.html` (always includes Aspora + Contentful case studies)
  - `resources/case-studies/{slug}/index.html` for each Contentful case study
- If `.env` is missing or Contentful keys are empty, the script exits without changing anything.

## 5. Render build

Build command is `npm install && npm run generate`. Ensure `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN` are set in Render **Environment**.

## 6. Blog preview (Contentful)

To preview **draft** blog posts on your site:

1. Deploy the **Preview API** (`preview-api/`) as a separate Render Web Service.
2. Set **Contentful → Settings → Content preview** → Preview URL:
   `https://www.theseopilot.pro/blog-preview?slug={{entry.fields.slug}}`
3. Configure `blog-preview/config.js` with your Preview API base URL.

See **docs/PREVIEW-SETUP.md** for full steps.

## 7. Aspora graph image

Add the GSC growth graph as:

```
assets/img/case-studies/aspora-gsc-growth.png
```

See `assets/img/case-studies/README.md`.
