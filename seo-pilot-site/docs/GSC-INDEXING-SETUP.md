# GSC Indexing Setup

End-to-end setup for `npm run index-urls` (Google Indexing API) + sitemap regen + Search Console sitemap submit.

## Auth (one-time)

Two supported modes — pick **one**:

### Mode A — gcloud user auth (recommended, simplest)

```bash
# Install gcloud (one time)
brew install --cask google-cloud-sdk

# Log in with the Google account that owns theseopilot.pro in Search Console
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/indexing,https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
```

In `.env`:

```
GSC_PROPERTY_URL=https://theseopilot.pro/
SITE_BASE_URL=https://theseopilot.pro
```

Leave `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` **unset**. The script uses Application Default Credentials automatically.

### Mode B — Service-account JSON key (for unattended/CI)

1. GCP Console → IAM & Admin → Service Accounts → create one (e.g. `seo-pilot-indexer`).
2. Enable the **Indexing API** under APIs & Services → Library.
3. Service Account → Keys → Add Key → Create new key → JSON → download.
4. Save somewhere private:
   ```bash
   mkdir -p ~/.secrets && chmod 700 ~/.secrets
   mv ~/Downloads/<project>-*.json ~/.secrets/gsc-service-account.json
   chmod 600 ~/.secrets/gsc-service-account.json
   ```
5. Search Console → property `theseopilot.pro` → Settings → Users and permissions → Add user → paste the SA email → role **Owner**.
   (As of April 2026 this UI is broken for SA emails — if you hit "email not found", use Mode A instead.)

In `.env`:

```
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/Users/<you>/.secrets/gsc-service-account.json
GSC_PROPERTY_URL=https://theseopilot.pro/
SITE_BASE_URL=https://theseopilot.pro
```

## The flow

```
[ npm run push-content ]                    publishes content to Contentful
                  │
                  ▼  on each successful publish, the URL is appended to
                     content/.indexing-queue.jsonl with status="pending"

[ npm run update-sitemap ]                  rebuilds sitemap.xml from
                                            Contentful + static pages

[ npm run index-urls ]                      reads pending URLs, submits each
                                            to Google's Indexing API, then
                                            also submits sitemap.xml to GSC.
                                            Queue entries flip to status="submitted".
```

Typical workflow after editing markdown:

```bash
npm run push-content       # publish to Contentful, queue URLs
npm run update-sitemap     # regen sitemap.xml from fresh Contentful
git add sitemap.xml && git commit -m "Update sitemap" && git push
# (wait a minute for your hosting to redeploy)
npm run index-urls         # submit each URL + sitemap to Google
```

## CLI flags

```
npm run index-urls                       # process all pending + sitemap submit
npm run index-urls -- --dry-run          # validate auth + show plan, no API calls
npm run index-urls -- --slug=foo         # only that URL
npm run index-urls -- --resubmit         # ignore "submitted" status, submit again
npm run index-urls -- --type=URL_DELETED # tell Google a URL was removed
npm run index-urls -- --no-sitemap       # skip the Search Console sitemap submit
npm run index-urls -- --sitemap-only     # only do the sitemap submit
```

## Quotas

- Indexing API: 200 requests/day per project by default. The script uses `await sleep(200ms)` between calls.
- Search Console API: well above what we use.

## ⚠️ Honest caveat on Google's Indexing API

Google's [official prerequisites](https://developers.google.com/search/apis/indexing-api/v3/prereqs) say the Indexing API is for `JobPosting` and `BroadcastEvent` structured data only. In practice, the API accepts and processes any URL — the entire SEO industry uses it for general content. It speeds up crawls but isn't officially endorsed for non-job/event pages.

The sitemap submit step (`webmasters.sitemaps.submit`) is **fully supported** and ToS-compliant — that's your clean baseline if the Indexing API ever gets clamped down.

## Queue file format

`content/.indexing-queue.jsonl` (gitignored, local state only):

```json
{"url":"https://theseopilot.pro/resources/case-studies/jac-...","type":"case-study","slug":"jac-...","queuedAt":"2026-05-22T08:42:00.000Z","status":"pending"}
{"url":"https://theseopilot.pro/resources/blog/foo/","type":"blog","slug":"foo","queuedAt":"2026-05-22T08:43:01.000Z","status":"submitted","submittedAt":"2026-05-22T08:43:11.000Z"}
```

It doubles as an audit log — every URL you've ever published + every indexing attempt.
