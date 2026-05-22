#!/usr/bin/env node
/**
 * Push local content to Contentful as published entries.
 *
 * Source format: content/{case-studies,blog}/*.md
 *   - YAML frontmatter for simple fields
 *   - Markdown body split by `## Section` into rich-text fields
 *
 * For each case-study file we create/update:
 *   1. A Component – SEO entry (using frontmatter.seo)
 *   2. A Page – Case Study entry, linked to that SEO entry
 *   Both get published unless --draft is passed.
 *
 * Upsert key: fields.slug (or fields.adminSlug for case studies — configurable).
 *
 * Required env (.env):
 *   CONTENTFUL_SPACE_ID
 *   CONTENTFUL_MANAGEMENT_TOKEN
 *
 * Optional env:
 *   CONTENTFUL_ENVIRONMENT             (default: master)
 *   CONTENTFUL_BLOG_CONTENT_TYPE       (default: pageBlogPost)
 *   CONTENTFUL_CASE_STUDY_CONTENT_TYPE (default: caseStudyPage)
 *   CONTENTFUL_SEO_COMPONENT_TYPE      (default: seoComponent)
 *   CONTENTFUL_CS_SLUG_FIELD           (default: adminSlug)
 *   CONTENTFUL_CS_SEO_FIELD            (default: ogSeoFields)
 *   CONTENTFUL_BLOG_SLUG_FIELD         (default: slug)
 *   CONTENTFUL_BLOG_SEO_FIELD          (default: seoFields)
 *   CONTENTFUL_LOCALE                  (default: en-US)
 *
 * CLI:
 *   npm run push-content
 *   npm run push-content -- --type=case-study
 *   npm run push-content -- --type=blog
 *   npm run push-content -- --slug=jac-interiors-la-fl-dual-market
 *   npm run push-content -- --dry-run
 *   npm run push-content -- --draft         (push as draft, do not publish)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { createClient } = require('contentful-management');
const { toRichText, EMPTY_DOC } = require('./markdown-to-richtext');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadDotenv() {
  try { require('dotenv').config({ path: path.join(ROOT, '.env') }); } catch (_) {}
}
loadDotenv();

const CFG = {
  spaceId:     process.env.CONTENTFUL_SPACE_ID || '',
  cmaToken:    process.env.CONTENTFUL_MANAGEMENT_TOKEN || '',
  environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  locale:      process.env.CONTENTFUL_LOCALE || 'en-US',
  blogType:    process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'pageBlogPost',
  csType:      process.env.CONTENTFUL_CASE_STUDY_CONTENT_TYPE || 'caseStudyPage',
  seoType:     process.env.CONTENTFUL_SEO_COMPONENT_TYPE || 'seoComponent',
  csSlugField: process.env.CONTENTFUL_CS_SLUG_FIELD || 'adminSlug',
  csSeoField:  process.env.CONTENTFUL_CS_SEO_FIELD || 'ogSeoFields',
  blogSlugField: process.env.CONTENTFUL_BLOG_SLUG_FIELD || 'slug',
  blogSeoField:  process.env.CONTENTFUL_BLOG_SEO_FIELD || 'seoFields',
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { type: null, slug: null, dryRun: false, draft: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--draft') args.draft = true;
    else if (raw.startsWith('--type=')) args.type = raw.slice('--type='.length);
    else if (raw.startsWith('--slug=')) args.slug = raw.slice('--slug='.length);
    else console.warn(`Unknown arg: ${raw}`);
  }
  return args;
}

const ARGS = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// File discovery + parsing
// ---------------------------------------------------------------------------

function listContentFiles() {
  const files = [];
  for (const sub of ['case-studies', 'blog']) {
    const dir = path.join(CONTENT_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    const type = sub === 'case-studies' ? 'case-study' : 'blog';
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      files.push({ filePath: path.join(dir, name), defaultType: type });
    }
  }
  return files;
}

/** Split markdown body on lines matching /^##\s+(.+)$/ (h2 only, not h3+). */
function splitSections(md) {
  const sections = {};
  if (!md) return sections;
  const lines = md.split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) sections[current] = buf.join('\n').trim();
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !line.startsWith('### ')) {
      flush();
      current = m[1].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

const SECTION_MAP = {
  'case-study': {
    challenge: 'challenge',
    strategy: 'strategy',
    result: 'result',
    results: 'result',
    purpose: 'purpose',
  },
  blog: {
    content: 'content',
    faqs: 'faqs',
    'frequently asked questions': 'faqs',
  },
};

function parseFile(filePath, defaultType) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const type = (data.type || defaultType || 'case-study').toLowerCase();
  const sections = splitSections(content);
  return { filePath, type, frontmatter: data, sections };
}

// ---------------------------------------------------------------------------
// Locale wrapping
// ---------------------------------------------------------------------------

function L(v) { return { [CFG.locale]: v }; }

function buildLocalizedFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[k] = L(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CMA wrapper (plain client)
// ---------------------------------------------------------------------------

class CMA {
  constructor() {
    this.client = createClient({ accessToken: CFG.cmaToken });
    this.scope = { spaceId: CFG.spaceId, environmentId: CFG.environment };
  }

  async getEntriesByField(contentTypeId, fieldId, value) {
    const res = await this.client.entry.getMany({
      ...this.scope,
      query: {
        content_type: contentTypeId,
        [`fields.${fieldId}`]: value,
        limit: 1,
      },
    });
    return res.items || [];
  }

  async createEntry(contentTypeId, fields) {
    return this.client.entry.create(
      { ...this.scope, contentTypeId },
      { fields }
    );
  }

  async updateEntry(existing, fields) {
    // Plain client requires us to merge sys+fields and pass via entry.update
    const updated = { ...existing, fields };
    return this.client.entry.update(
      { ...this.scope, entryId: existing.sys.id },
      updated
    );
  }

  async publishEntry(entry) {
    return this.client.entry.publish(
      { ...this.scope, entryId: entry.sys.id },
      entry
    );
  }
}

// ---------------------------------------------------------------------------
// Upsert flow
// ---------------------------------------------------------------------------

async function upsertByField(cma, contentTypeId, slugFieldId, slug, plainFields, opts) {
  const fields = buildLocalizedFields(plainFields);
  const items = await cma.getEntriesByField(contentTypeId, slugFieldId, slug);
  let entry;
  let action;
  if (items[0]) {
    entry = await cma.updateEntry(items[0], fields);
    action = 'updated';
  } else {
    entry = await cma.createEntry(contentTypeId, fields);
    action = 'created';
  }
  if (!opts.draft) {
    entry = await cma.publishEntry(entry);
    action = action === 'created' ? 'created+published' : 'updated+published';
  }
  return { entry, action };
}

async function upsertSeo(cma, seoPlain, opts) {
  const fields = buildLocalizedFields(seoPlain);
  // SEO components are matched by canonicalUrl
  const items = await cma.getEntriesByField(CFG.seoType, 'canonicalUrl', seoPlain.canonicalUrl);
  let entry;
  if (items[0]) {
    entry = await cma.updateEntry(items[0], fields);
  } else {
    entry = await cma.createEntry(CFG.seoType, fields);
  }
  if (!opts.draft) {
    entry = await cma.publishEntry(entry);
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Case study / blog pushers
// ---------------------------------------------------------------------------

async function pushCaseStudy(cma, parsed, opts) {
  const fm = parsed.frontmatter;
  const slug = fm.slug;
  if (!slug) throw new Error('Missing frontmatter.slug');

  const seo = fm.seo || {};
  const seoPlain = {
    pageTitle:       seo.pageTitle || fm.h1 || fm.clientName || slug,
    pageDescription: seo.pageDescription || '',
    canonicalUrl:    seo.canonicalUrl || `https://theseopilot.pro/resources/case-studies/${slug}/`,
    noindex:         !!seo.noindex,
    nofollow:        !!seo.nofollow,
  };
  const seoEntry = await upsertSeo(cma, seoPlain, opts);

  const richFields = {};
  for (const [sectionName, body] of Object.entries(parsed.sections)) {
    const fieldId = SECTION_MAP['case-study'][sectionName.toLowerCase()];
    if (!fieldId) continue;
    richFields[fieldId] = await toRichText(body);
  }
  for (const fid of ['challenge', 'strategy', 'result']) {
    if (!richFields[fid]) richFields[fid] = EMPTY_DOC;
  }

  const csPlain = {
    internalName:    fm.internalName || fm.clientName || slug,
    [CFG.csSlugField]: slug,
    clientName:      fm.clientName,
    industry:        fm.industry,
    h1:              fm.h1,
    contextTimeframe: fm.contextTimeframe,
    keyMetrics:      fm.keyMetrics,
    ...richFields,
    [CFG.csSeoField]: {
      sys: { type: 'Link', linkType: 'Entry', id: seoEntry.sys.id },
    },
  };
  const result = await upsertByField(cma, CFG.csType, CFG.csSlugField, slug, csPlain, opts);
  return { csAction: result.action, csId: result.entry.sys.id, seoId: seoEntry.sys.id };
}

async function pushBlog(cma, parsed, opts) {
  const fm = parsed.frontmatter;
  const slug = fm.slug;
  if (!slug) throw new Error('Missing frontmatter.slug');

  const seo = fm.seo || {};
  const seoPlain = {
    pageTitle:       seo.pageTitle || fm.title || slug,
    pageDescription: seo.pageDescription || fm.subtitle || '',
    canonicalUrl:    seo.canonicalUrl || `https://theseopilot.pro/resources/blog/${slug}/`,
    noindex:         !!seo.noindex,
    nofollow:        !!seo.nofollow,
  };
  const seoEntry = await upsertSeo(cma, seoPlain, opts);

  const richFields = {};
  for (const [sectionName, body] of Object.entries(parsed.sections)) {
    const fieldId = SECTION_MAP.blog[sectionName.toLowerCase()];
    if (!fieldId) continue;
    richFields[fieldId] = await toRichText(body);
  }
  if (!richFields.content) richFields.content = EMPTY_DOC;

  const blogPlain = {
    internalName: fm.internalName || fm.title || slug,
    [CFG.blogSlugField]: slug,
    title:        fm.title,
    subtitle:     fm.subtitle,
    publishedDate: fm.publishedDate,
    ...richFields,
    [CFG.blogSeoField]: {
      sys: { type: 'Link', linkType: 'Entry', id: seoEntry.sys.id },
    },
  };
  const result = await upsertByField(cma, CFG.blogType, CFG.blogSlugField, slug, blogPlain, opts);
  return { blogAction: result.action, blogId: result.entry.sys.id, seoId: seoEntry.sys.id };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ARGS.dryRun && (!CFG.spaceId || !CFG.cmaToken)) {
    console.error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(2);
  }

  const all = listContentFiles();
  if (all.length === 0) {
    console.log('No content files found under content/. Nothing to push.');
    return;
  }

  const parsedAll = all.map(({ filePath, defaultType }) => parseFile(filePath, defaultType));
  const parsedFiltered = parsedAll.filter((p) => {
    if (ARGS.slug && p.frontmatter.slug !== ARGS.slug) return false;
    if (ARGS.type && p.type !== ARGS.type) return false;
    return true;
  });

  if (parsedFiltered.length === 0) {
    console.log('No content files matched the filters. Nothing to push.');
    return;
  }

  console.log(`==> ${ARGS.dryRun ? 'DRY-RUN' : 'PUSH'} ${parsedFiltered.length} file(s) to ${CFG.spaceId}/${CFG.environment} (${ARGS.draft ? 'draft' : 'published'})`);

  if (ARGS.dryRun) {
    for (const p of parsedFiltered) {
      const sections = Object.keys(p.sections).join(', ') || '(none)';
      console.log(`  - ${path.relative(ROOT, p.filePath)}  type=${p.type}  slug=${p.frontmatter.slug}  sections=[${sections}]`);
    }
    console.log('(no API calls made)');
    return;
  }

  const cma = new CMA();
  const opts = { draft: ARGS.draft };

  const summary = { pushed: 0, failed: 0, items: [] };
  for (const p of parsedFiltered) {
    const rel = path.relative(ROOT, p.filePath);
    try {
      let outcome;
      if (p.type === 'case-study') outcome = await pushCaseStudy(cma, p, opts);
      else if (p.type === 'blog')   outcome = await pushBlog(cma, p, opts);
      else throw new Error(`Unknown type "${p.type}" in ${rel}`);
      console.log(`  ✓ ${rel} → ${JSON.stringify(outcome)}`);
      summary.pushed += 1;
      summary.items.push({ ok: true, rel, ...outcome });
    } catch (e) {
      const detail = e.details ? ` :: ${JSON.stringify(e.details).slice(0, 240)}` : '';
      console.log(`  ✗ ${rel} → ${e.message}${detail}`);
      summary.failed += 1;
      summary.items.push({ ok: false, rel, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log('');
  console.log(`==> Done. pushed=${summary.pushed} failed=${summary.failed}`);
  if (summary.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e.stack || e.message);
  process.exit(1);
});
