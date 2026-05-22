# TheSEOPilot — New Laptop Setup Guide

A complete, top-to-bottom setup for a fresh Mac so the publish + index + ship pipeline works the same as on your old machine.

Assumed username on the new Mac: **`shipsy`** (same as today).
If your username will be different, see the **Path adjustment** section at the very end first.

---

## 0. What you'll be setting up

Three independent pipelines that work together:

| Pipeline | What it does | Trigger |
|---|---|---|
| **Contentful push** | Pushes `content/case-studies/*.md` and `content/blog/*.md` to your Contentful space, creating linked `Component – SEO` + `Page – Case Study/Blog Post` entries, and queues their URLs for indexing | `npm run push-content` |
| **Sitemap regen** | Pulls live entries from Contentful + the static page list → writes a fresh `sitemap.xml` | `npm run update-sitemap` |
| **Google indexing** | Calls Google's Indexing API on each queued URL, then submits the sitemap to Search Console | `npm run index-urls` |
| **Push to live** | Clones the GitHub repo into `~/Downloads/the-seo-pilot-site-clone`, copies edited files in, commits, pushes to `main` | `bash push-to-github.sh` |

---

## 1. Prerequisites — install once

### 1.1. Homebrew (Mac package manager)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
At the end of install it'll print two `eval` commands to add brew to PATH — run them and add them to `~/.zshrc`.

### 1.2. Node.js (22+) — for all `npm run *` scripts
```bash
brew install node@22
brew link --overwrite node@22
node -v   # should print v22.x or newer
npm -v
```

### 1.3. git + GitHub CLI — for `push-to-github.sh`
```bash
brew install git gh
git --version
gh --version
```

### 1.4. gcloud CLI — for the indexing pipeline
```bash
brew install --cask google-cloud-sdk
# Restart the terminal once so PATH picks up gcloud
gcloud --version
```

---

## 2. Get the code

### 2.1. The working project folder
Clone the repo into the exact same path as on your old laptop:

```bash
mkdir -p ~/Downloads
cd ~/Downloads
git clone https://github.com/Admin0TSP/the-seo-pilot-site.git seo-pilot-site
```

You should now have everything inside:
```
/Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/
```

(The repo's actual content lives one level deep at `seo-pilot-site/seo-pilot-site/` — that's why the clone target is named `seo-pilot-site` and the actual project sits inside it. The `push-to-github.sh` script depends on that nesting.)

### 2.2. Install npm dependencies
```bash
cd /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site
npm install
```

This will install: `contentful-management`, `gray-matter`, `@contentful/rich-text-from-markdown`, `googleapis`, `dotenv`, etc.

---

## 3. Set up `.env`

The `.env` file is **not** in git (it's secret). Copy its content from your old laptop, or recreate it from scratch:

```bash
cp /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/.env.example \
   /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/.env

nano /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/.env
```

Fill in these values (the ones marked **REQUIRED** must have actual secrets, the rest are optional overrides):

```
# REQUIRED — Contentful read API (used by generate + sitemap regen)
CONTENTFUL_SPACE_ID=fsgcu9ldlz5c
CONTENTFUL_ACCESS_TOKEN=<paste from Contentful → Settings → API keys → CDA token>

# REQUIRED for push-content — Contentful write API
CONTENTFUL_MANAGEMENT_TOKEN=<paste from Contentful → Settings → API keys → Content management tokens>

# Optional — preview API token (for the /blog-preview flow)
CONTENTFUL_PREVIEW_TOKEN=<paste from Contentful CDA preview key, if you use preview>

# REQUIRED for index-urls — GSC property and site base
GSC_PROPERTY_URL=sc-domain:theseopilot.pro
SITE_BASE_URL=https://theseopilot.pro

# Leave UNSET if you're using `gcloud auth application-default login` (recommended).
# Only set this if you're using a service-account JSON key.
# GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/Users/shipsy/.secrets/gsc-service-account.json
```

### Where to get the Contentful tokens
1. Log into Contentful → pick the `theseopilot` space.
2. **Settings → API keys**.
3. There's one CDA key under "Content delivery / preview tokens" — copy the **Content Delivery API - access token** into `CONTENTFUL_ACCESS_TOKEN` and the **Content Preview API - access token** into `CONTENTFUL_PREVIEW_TOKEN`.
4. Click the **"Content management tokens"** tab → **Generate personal token** → name it "Local push" → copy the value into `CONTENTFUL_MANAGEMENT_TOKEN`. (This token is shown ONCE — save it now.)

### Quick sanity check
```bash
cd /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site
node -e "require('dotenv').config(); console.log({
  space: !!process.env.CONTENTFUL_SPACE_ID,
  cda:   !!process.env.CONTENTFUL_ACCESS_TOKEN,
  cma:   !!process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  gsc:   process.env.GSC_PROPERTY_URL,
})"
```
All booleans should be `true` and `gsc` should print `sc-domain:theseopilot.pro`.

---

## 4. Auth to GitHub (one time)

```bash
gh auth login
```
Walkthrough:
- Where do you use GitHub? → **GitHub.com**
- Preferred protocol → **HTTPS**
- Authenticate Git with your GitHub credentials? → **Yes**
- How would you like to authenticate? → **Login with a web browser**

Copy the one-time code, press Enter, paste it in the browser, choose the account that owns `Admin0TSP/the-seo-pilot-site`.

Then wire git to use gh's credentials:
```bash
gh auth setup-git
```

Verify with a no-op fetch:
```bash
cd /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site
git fetch
```
Should succeed silently. If you get a 403, repeat `gh auth login` with the right account.

---

## 5. Auth to Google (one time, for indexing)

Use the Google account that's an Owner of `theseopilot.pro` in Search Console (i.e. the one you use to log into GSC):

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/indexing,https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
```

A browser opens — sign in, grant the three scopes. When you see "Credentials saved to file...", you're done.

Set the quota project so the APIs charge against your GCP project:
```bash
gcloud auth application-default set-quota-project singular-elixir-486905-a1
```

(That project ID is from your original setup. If you ever create a new GCP project, replace this ID.)

Enable the two APIs in that GCP project (you only need to do this once per project — already done in yours, but harmless to re-run):
```bash
gcloud services enable indexing.googleapis.com searchconsole.googleapis.com --project=singular-elixir-486905-a1
```

### Verify auth + property
```bash
TOKEN=$(gcloud auth application-default print-access-token)
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: singular-elixir-486905-a1" \
  "https://www.googleapis.com/webmasters/v3/sites" | python3 -m json.tool
```
Should return a JSON list with `sc-domain:theseopilot.pro` and `permissionLevel: siteOwner`.

---

## 6. Smoke-test everything

Run each pipeline in dry-run mode — no API calls, just config checks:

```bash
cd /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site

npm run push-content -- --dry-run        # lists files it would push
npm run update-sitemap                   # writes sitemap.xml — safe, just regenerates
npm run index-urls -- --dry-run          # shows what would be submitted
```

If all three succeed, you're done with setup. The new laptop is at parity with the old one.

---

## 7. Daily workflow — the four commands

### 7.1. Add or edit a case study / blog
Open or create a markdown file:
```bash
# Case study
nano content/case-studies/<your-slug>.md

# Blog post
nano content/blog/<your-slug>.md
```
Follow the YAML frontmatter format documented in `content/README.md`.

### 7.2. Push to Contentful
```bash
npm run push-content
```
Or for one specific file:
```bash
npm run push-content -- --slug=jac-interiors-la-fl-dual-market
```
Or to upload as draft (review in Contentful UI before publishing):
```bash
npm run push-content -- --draft
```

What it does:
- Creates / updates the Component – SEO entry first
- Creates / updates the Page – Case Study (or Blog Post) entry, linked to the SEO entry
- Publishes both (unless `--draft`)
- Appends the URL to `content/.indexing-queue.jsonl` (unless `--draft` or `--no-queue`)

### 7.3. Regenerate the sitemap from Contentful
```bash
npm run update-sitemap
```
Writes a fresh `sitemap.xml` with all live entries + the static pages.

### 7.4. Ship the code to git → live site
```bash
bash push-to-github.sh
```
This script:
- Clones the remote into `~/Downloads/the-seo-pilot-site-clone` (if not already)
- Pulls latest from `main`
- Copies your edited files into the clone (CSS, JS, HTML, scripts, content, sitemap, etc.)
- Removes the hardcoded `resources/case-studies/aspora-ai-visibility/` legacy folder if present
- Commits + pushes to `origin/main`

After git push, your hosting platform (Vercel / Netlify / etc.) auto-deploys.

### 7.5. Tell Google about the new URLs
```bash
npm run index-urls
```
This:
- Submits each `status: pending` URL in `content/.indexing-queue.jsonl` to the Indexing API
- Submits the sitemap to Search Console
- Updates the queue entries to `status: submitted` with timestamps

### 7.6. The full sequence
```bash
# All four commands, in order:
npm run push-content
npm run update-sitemap
bash push-to-github.sh
npm run index-urls
```

---

## 8. Useful CLI flags reference

### `npm run push-content`
| Flag | Behavior |
|---|---|
| `--dry-run` | Parse + validate files, no API calls |
| `--draft` | Push but don't publish; also skips queue |
| `--no-queue` | Push + publish but don't queue for indexing |
| `--type=case-study` or `--type=blog` | Filter by type |
| `--slug=<slug>` | Only that specific entry |

### `npm run index-urls`
| Flag | Behavior |
|---|---|
| `--dry-run` | Auth check + plan, no API calls |
| `--slug=<slug>` | Only that URL |
| `--resubmit` | Re-submit already-submitted URLs |
| `--type=URL_DELETED` | Tell Google a URL was removed |
| `--no-sitemap` | Skip the Search Console sitemap submit |
| `--sitemap-only` | Only sitemap, skip per-URL submissions |

### `npm run update-sitemap`
No flags. Always regenerates `sitemap.xml`.

---

## 9. Troubleshooting cheatsheet

### "Missing CONTENTFUL_SPACE_ID or CONTENTFUL_MANAGEMENT_TOKEN"
Your `.env` isn't set up. Re-do Section 3.

### "Auth failed: GOOGLE_SERVICE_ACCOUNT_KEY_FILE not found at ..."
You set the key-file env var but the file isn't there. Either:
- Comment / delete the `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=` line in `.env` (recommended — falls back to gcloud user auth), or
- Move your service-account JSON key to that path.

### "Web Search Indexing API has not been used in project ..."
The APIs aren't enabled in your GCP project. Re-run:
```bash
gcloud services enable indexing.googleapis.com searchconsole.googleapis.com --project=singular-elixir-486905-a1
```
Wait 30 seconds. Try again.

### "User does not have sufficient permission for site '...'"
`GSC_PROPERTY_URL` in `.env` doesn't match the verified property type:
- Domain property → use `sc-domain:theseopilot.pro`
- URL-prefix property → use `https://theseopilot.pro/` (with trailing slash)

Run the diagnostic curl in Section 5 to see which one you have.

### "PERMISSION_DENIED" / "quota project not set"
```bash
gcloud auth application-default set-quota-project singular-elixir-486905-a1
```

### "Failed to add user: email not found" in Search Console
Known Google bug (April 2026, ongoing). Don't try to add the service account as a GSC user — use `gcloud auth application-default login` instead and authenticate as yourself. See Section 5.

### `git push` returns 403
GitHub credentials are stale. Re-run:
```bash
gh auth login && gh auth setup-git
```

### Contentful push throws "Unknown field" or "Field validation"
A field ID in your space differs from the script's default. Set the override in `.env`:
```
CONTENTFUL_CS_SLUG_FIELD=<actual API ID>
CONTENTFUL_CS_SEO_FIELD=<actual API ID>
```
Then re-run.

### Queue file got corrupted
```bash
rm /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/content/.indexing-queue.jsonl
```
Next `npm run push-content` will rebuild it from new pushes. Previously-submitted URLs are already on Google — losing the queue file just loses the local audit log, not the indexing work.

---

## 10. Critical files & paths reference

### Files to bring over from the old laptop
| File on old laptop | Why | Treat as |
|---|---|---|
| `~/Downloads/seo-pilot-site/seo-pilot-site/.env` | All secrets | Secret — copy via USB / 1Password, never email |
| `~/.config/gcloud/application_default_credentials.json` | (Optional) Skip and re-do Section 5 instead | Secret |

### Files you should NOT bring over
- `~/Downloads/seo-pilot-site/seo-pilot-site/node_modules/` — recreated by `npm install`
- `~/Downloads/seo-pilot-site/seo-pilot-site/content/.indexing-queue.jsonl` — local-only audit log; will be repopulated as you push new content
- `~/Downloads/the-seo-pilot-site-clone/` — the script will re-clone it the first time you run `push-to-github.sh`

### Static identifiers (won't change)
- GitHub repo: `https://github.com/Admin0TSP/the-seo-pilot-site.git`
- GCP project ID: `singular-elixir-486905-a1`
- Contentful space ID: `fsgcu9ldlz5c`
- GSC property: `sc-domain:theseopilot.pro`
- Site base URL: `https://theseopilot.pro`

---

## 11. Path adjustment — if your new Mac username isn't `shipsy`

`push-to-github.sh` has hardcoded paths to `/Users/shipsy/...`. If your username changes:

```bash
# Replace "shipsy" with your new username everywhere in the push script
sed -i '' 's|/Users/shipsy/|/Users/<YOUR_USERNAME>/|g' \
  ~/Downloads/seo-pilot-site/seo-pilot-site/push-to-github.sh
```

Same drill for any service-account file path you had in `.env`.

You also don't have to keep the folder under `~/Downloads` — anywhere works. Just update the `LOCAL_SITE` variable at the top of `push-to-github.sh` to match.

---

## 12. The "first run" checklist on the new laptop

Copy-paste this into the terminal once to walk through every step in order:

```bash
# Prerequisites
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22 git gh
brew install --cask google-cloud-sdk

# Clone the repo
mkdir -p ~/Downloads && cd ~/Downloads
git clone https://github.com/Admin0TSP/the-seo-pilot-site.git seo-pilot-site
cd seo-pilot-site/seo-pilot-site
npm install

# Create .env (paste the secrets manually)
cp .env.example .env
open -a TextEdit .env    # fill in CONTENTFUL_*, GSC_PROPERTY_URL, SITE_BASE_URL

# GitHub
gh auth login
gh auth setup-git

# Google for indexing
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/indexing,https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
gcloud auth application-default set-quota-project singular-elixir-486905-a1

# Smoke test all three pipelines
npm run push-content -- --dry-run
npm run update-sitemap
npm run index-urls -- --dry-run

echo "✓ New laptop is set up. Run the daily flow whenever you have new content."
```

That's it. If any step fails, jump to the Troubleshooting cheatsheet (Section 9).

---

## 13. Daily flow — cheat card to keep open

```
1.  Edit content/case-studies/<slug>.md   (or content/blog/<slug>.md)
2.  npm run push-content                  (publish to Contentful + queue URL)
3.  npm run update-sitemap                (rebuild sitemap.xml)
4.  bash push-to-github.sh                (ship code + sitemap to live)
5.  npm run index-urls                    (notify Google: index this URL + sitemap)
```

Done.
