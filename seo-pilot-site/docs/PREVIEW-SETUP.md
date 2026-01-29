# Contentful Blog Preview Setup

This guide configures **Contentful Content Preview** for blog posts so editors can preview drafts on your site.

## 1. Contentful Preview platform

1. In [Contentful](https://app.contentful.com), go to **Settings → Content preview**.
2. **Create** a new preview platform.
3. Use:
   - **Name:** `TSP Blog Preview`
   - **Description:** (optional) e.g. *Preview blog posts on theseopilot.pro*
   - **Preview URL for Page - Blog Post** (or your blog content type):
     ```
     https://www.theseopilot.pro/blog-preview?slug={{entry.fields.slug}}
     ```
     Or by entry ID:
     ```
     https://www.theseopilot.pro/blog-preview?id={{entry.id}}
     ```
4. **Save** and ensure the platform is **enabled** for your blog content type.

## 2. Preview API (Node proxy)

The preview page fetches draft content via a small **Preview API** service. The Preview token must stay server-side.

1. **Deploy the Preview API** (e.g. as a Render Web Service):
   - Use the `preview-api/` folder.
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Environment:**
     - `CONTENTFUL_SPACE_ID` — your space ID
     - `CONTENTFUL_PREVIEW_TOKEN` — **Content preview / Preview API** token (not Delivery)
     - Optional: `CONTENTFUL_BLOG_CONTENT_TYPE` — default `blogPost`
     - Optional: `PORT` — default `3456`

2. Get the **Preview** token:
   - Contentful → **Settings → API keys** → your key.
   - Use the **Content preview API - access token** (or “Preview” token), **not** the Delivery token.

3. Note the **base URL** of the deployed service, e.g.:
   ```
   https://tsp-blog-preview.onrender.com
   ```

## 3. Configure the preview page

Set that base URL on the site:

1. Edit **`blog-preview/config.js`**.
2. Set:
   ```js
   window.PREVIEW_API_BASE = 'https://your-preview-api.onrender.com';
   ```
   Use the actual URL of your deployed Preview API (no trailing slash).

## 4. CORS

The Preview API allows:

- `https://theseopilot.pro`, `https://www.theseopilot.pro`
- `http://localhost:*`, `http://127.0.0.1:*`

If you use another preview domain, add it in `preview-api/server.js` → `ALLOW_ORIGINS`.

## 5. Flow

1. Editor opens a **blog post** in Contentful.
2. Clicks **Preview** → Contentful opens:
   `https://www.theseopilot.pro/blog-preview?slug=my-post-slug`
3. The preview page calls:
   `https://your-preview-api.onrender.com/api/preview?slug=my-post-slug`
4. The API fetches the entry from **Contentful Preview API** and returns JSON.
5. The page renders the post (title, body, etc.).

## 6. Optional: Render Web Service

Example **Render** setup for `preview-api/`:

- **Type:** Web Service
- **Root directory:** `preview-api` (if repo root is above it)
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment:** `CONTENTFUL_SPACE_ID`, `CONTENTFUL_PREVIEW_TOKEN`

Use the resulting URL (e.g. `https://tsp-blog-preview.onrender.com`) in `blog-preview/config.js`.

## 7. `noindex`

The preview page sets `meta name="robots" content="noindex, nofollow"` so it is not indexed.

## 8. Embedding in Contentful (iframe)

Preview can open in a **new tab** or in an **iframe** in the editor. If you use the iframe and see “Refused to connect” or a blank preview:

- The site may send `X-Frame-Options: DENY`, which blocks embedding. A `Content-Security-Policy: frame-ancestors` rule for `/blog-preview` (allowing `https://app.contentful.com`, `https://be.contentful.com`) is set in `render.yaml`. If you use another host, add a similar header for `/blog-preview` so Contentful can embed it.

## 9. Troubleshooting

- **“Preview API base URL not set”**  
  Ensure `blog-preview/config.js` exists and `window.PREVIEW_API_BASE` is set correctly.

- **“Preview fetch failed” / CORS errors**  
  Check that the Preview API is running, the URL in `config.js` is correct, and your origin is allowed (see CORS above).

- **“Entry not found”**  
  Confirm the blog content type ID matches `CONTENTFUL_BLOG_CONTENT_TYPE` (default `blogPost`).  
  Verify the slug or id in the URL and that the entry exists (draft or published).

- **401 from Contentful**  
  Use the **Preview** access token, not the Delivery token.
