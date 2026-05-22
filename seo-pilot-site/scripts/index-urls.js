#!/usr/bin/env node
/**
 * Submit URLs to Google's Indexing API and (re-)submit the sitemap via
 * Search Console API.
 *
 * Reads pending URLs from content/.indexing-queue.jsonl (one JSON object per line),
 * submits each, and updates the line in place with status + timestamp + error.
 *
 * Auth (auto-detected by googleapis SDK):
 *   - If GOOGLE_SERVICE_ACCOUNT_KEY_FILE is set, uses that service-account JSON key.
 *   - Otherwise, uses Application Default Credentials (`gcloud auth application-default login`).
 *
 * Required env:
 *   GSC_PROPERTY_URL=https://theseopilot.pro/
 *
 * Optional env:
 *   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/sa-key.json
 *   SITE_BASE_URL=https://theseopilot.pro
 *   SITEMAP_PATH_REL=sitemap.xml
 *
 * CLI:
 *   npm run index-urls                       # process all pending URLs + ping sitemap
 *   npm run index-urls -- --dry-run          # parse + auth-check, no API calls
 *   npm run index-urls -- --slug=...         # only that slug
 *   npm run index-urls -- --resubmit         # ignore "submitted" status, submit again
 *   npm run index-urls -- --type=URL_DELETED # tell Google a URL was removed
 *   npm run index-urls -- --no-sitemap       # skip the Search Console sitemap submit
 *   npm run index-urls -- --sitemap-only     # only do the sitemap submit, no per-URL pushes
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'content', '.indexing-queue.jsonl');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadDotenv() {
  try { require('dotenv').config({ path: path.join(ROOT, '.env') }); } catch (_) {}
}
loadDotenv();

const CFG = {
  property:    process.env.GSC_PROPERTY_URL || 'https://theseopilot.pro/',
  siteBase:    process.env.SITE_BASE_URL || 'https://theseopilot.pro',
  sitemapRel:  process.env.SITEMAP_PATH_REL || 'sitemap.xml',
  saKeyFile:   process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '',
};
const SCOPES = [
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/webmasters',
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: false,
    slug: null,
    resubmit: false,
    type: 'URL_UPDATED',
    noSitemap: false,
    sitemapOnly: false,
  };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--resubmit') args.resubmit = true;
    else if (raw === '--no-sitemap') args.noSitemap = true;
    else if (raw === '--sitemap-only') args.sitemapOnly = true;
    else if (raw.startsWith('--slug=')) args.slug = raw.slice('--slug='.length);
    else if (raw.startsWith('--type=')) args.type = raw.slice('--type='.length);
    else console.warn(`Unknown arg: ${raw}`);
  }
  if (args.type !== 'URL_UPDATED' && args.type !== 'URL_DELETED') {
    console.error(`--type must be URL_UPDATED or URL_DELETED (got "${args.type}")`);
    process.exit(2);
  }
  return args;
}
const ARGS = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// Queue I/O — JSON Lines, atomic writes
// ---------------------------------------------------------------------------

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const items = [];
  for (const line of lines) {
    try { items.push(JSON.parse(line)); }
    catch (e) { console.warn(`Skipping malformed queue line: ${line.slice(0, 100)}…`); }
  }
  return items;
}

function saveQueue(items) {
  const tmp = QUEUE_FILE + '.tmp';
  fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
  fs.writeFileSync(tmp, items.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
  fs.renameSync(tmp, QUEUE_FILE);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getAuth() {
  const opts = { scopes: SCOPES };
  if (CFG.saKeyFile) {
    if (!fs.existsSync(CFG.saKeyFile)) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY_FILE not found at ${CFG.saKeyFile}`);
    }
    opts.keyFile = CFG.saKeyFile;
  }
  const auth = new google.auth.GoogleAuth(opts);
  // Force credential creation so we fail fast on missing ADC etc.
  const client = await auth.getClient();
  return { auth, client };
}

// ---------------------------------------------------------------------------
// Indexing API
// ---------------------------------------------------------------------------

async function submitUrl(indexing, url, type) {
  const res = await indexing.urlNotifications.publish({
    requestBody: { url, type },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Search Console — sitemap submit
// ---------------------------------------------------------------------------

async function submitSitemap(webmasters) {
  const sitemapUrl = CFG.siteBase.replace(/\/$/, '') + '/' + CFG.sitemapRel.replace(/^\//, '');
  // siteUrl is the GSC property URL exactly as it appears (URL-prefix or sc-domain).
  // For URL-prefix properties this is the full URL with trailing slash.
  await webmasters.sitemaps.submit({
    siteUrl: CFG.property,
    feedpath: sitemapUrl,
  });
  return sitemapUrl;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Determine work
  const all = loadQueue();
  let pending = all;
  if (ARGS.slug) pending = pending.filter((x) => x.slug === ARGS.slug);
  if (!ARGS.resubmit) pending = pending.filter((x) => x.status === 'pending' || x.status === 'failed');

  if (ARGS.sitemapOnly) pending = [];

  console.log(`==> ${ARGS.dryRun ? 'DRY-RUN' : 'INDEX'} ${pending.length} URL(s) | sitemap-submit=${!ARGS.noSitemap && !ARGS.dryRun}`);

  if (ARGS.dryRun) {
    for (const x of pending) console.log(`  - ${x.status.padEnd(10)} ${x.url}`);
    console.log(`  (would submit sitemap: ${CFG.siteBase.replace(/\/$/, '')}/${CFG.sitemapRel} via property ${CFG.property})`);
    return;
  }

  if (pending.length === 0 && (ARGS.noSitemap || ARGS.sitemapOnly === false && pending.length === 0)) {
    if (!ARGS.sitemapOnly && pending.length === 0 && ARGS.noSitemap) {
      console.log('Nothing to do.');
      return;
    }
  }

  // Auth + clients
  let auth;
  try {
    ({ auth } = await getAuth());
  } catch (e) {
    console.error('Auth failed:', e.message);
    process.exit(2);
  }
  const indexing = google.indexing({ version: 'v3', auth });
  const webmasters = google.webmasters({ version: 'v3', auth });

  // Per-URL submissions
  const summary = { ok: 0, failed: 0 };
  for (const item of pending) {
    try {
      const data = await submitUrl(indexing, item.url, ARGS.type);
      item.status = 'submitted';
      item.submittedAt = new Date().toISOString();
      item.type = ARGS.type;
      item.error = undefined;
      if (data && data.urlNotificationMetadata) item.notification = data.urlNotificationMetadata;
      console.log(`  ✓ ${item.url}`);
      summary.ok += 1;
    } catch (e) {
      const detail = (e.errors && e.errors[0]) || (e.response && e.response.data && e.response.data.error) || {};
      const msg = detail.message || e.message;
      item.status = 'failed';
      item.failedAt = new Date().toISOString();
      item.error = msg;
      console.log(`  ✗ ${item.url} → ${msg}`);
      summary.failed += 1;
    }
    // ~1 req/s — well under per-minute quota and rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  // Persist queue updates
  if (pending.length > 0) saveQueue(all);

  // Sitemap submit (one call per run)
  if (!ARGS.noSitemap) {
    try {
      const url = await submitSitemap(webmasters);
      console.log(`  ✓ sitemap submitted: ${url}`);
    } catch (e) {
      const detail = (e.errors && e.errors[0]) || (e.response && e.response.data && e.response.data.error) || {};
      const msg = detail.message || e.message;
      console.log(`  ✗ sitemap submit failed: ${msg}`);
      summary.failed += 1;
    }
  }

  console.log('');
  console.log(`==> Done. submitted=${summary.ok} failed=${summary.failed}`);
  if (summary.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e.stack || e.message);
  process.exit(1);
});
