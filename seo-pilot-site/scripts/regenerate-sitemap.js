#!/usr/bin/env node
/**
 * Regenerate sitemap.xml from:
 *   1. A static "core" list (home, /privacy, /terms, /resources, /resources/blog/, /resources/case-studies/)
 *   2. Contentful entries (Page – Blog Post + Page – Case Study) — same fetch the
 *      generator script already does.
 *
 * Output: writes sitemap.xml at project root.
 * Run: npm run update-sitemap
 *
 * Required env (.env):
 *   CONTENTFUL_SPACE_ID
 *   CONTENTFUL_ACCESS_TOKEN
 *
 * Optional env:
 *   SITE_BASE_URL=https://theseopilot.pro
 *   CONTENTFUL_BLOG_CONTENT_TYPE=pageBlogPost
 *   CONTENTFUL_CASE_STUDY_CONTENT_TYPE=caseStudyPage
 */

const fs = require('fs');
const path = require('path');
const { unwrap } = require('./contentful-helpers');

const ROOT = path.resolve(__dirname, '..');

function loadDotenv() {
  try { require('dotenv').config({ path: path.join(ROOT, '.env') }); } catch (_) {}
}
loadDotenv();

const CFG = {
  base:        (process.env.SITE_BASE_URL || 'https://theseopilot.pro').replace(/\/$/, ''),
  spaceId:     process.env.CONTENTFUL_SPACE_ID || '',
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || '',
  blogType:    process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'pageBlogPost',
  csType:      process.env.CONTENTFUL_CASE_STUDY_CONTENT_TYPE || 'caseStudyPage',
};

const STATIC_URLS = [
  { loc: '/',                          changefreq: 'daily',   priority: '1.00' },
  { loc: '/privacy/',                  changefreq: 'yearly',  priority: '0.50' },
  { loc: '/terms/',                    changefreq: 'yearly',  priority: '0.50' },
  { loc: '/resources/',                changefreq: 'weekly',  priority: '0.85' },
  { loc: '/resources/blog/',           changefreq: 'weekly',  priority: '0.85' },
  { loc: '/resources/case-studies/',   changefreq: 'weekly',  priority: '0.75' },
];

function fmtDate(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function fetchContentful(endpoint) {
  const url = `https://cdn.contentful.com/spaces/${CFG.spaceId}/environments/master${endpoint}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFG.accessToken}` } });
  if (!res.ok) throw new Error(`Contentful ${res.status}: ${await res.text()}`);
  return res.json();
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  const entries = [];
  // Static core
  for (const s of STATIC_URLS) {
    entries.push(urlEntry({
      loc: CFG.base + s.loc,
      lastmod: today,
      changefreq: s.changefreq,
      priority: s.priority,
    }));
  }

  // Contentful entries
  if (CFG.spaceId && CFG.accessToken) {
    try {
      const [blog, cs] = await Promise.all([
        fetchContentful(`/entries?content_type=${CFG.blogType}&order=-fields.publishedDate&include=0&locale=*`).catch(() => ({ items: [] })),
        fetchContentful(`/entries?content_type=${CFG.csType}&order=-sys.updatedAt&include=0&locale=*`).catch(() => ({ items: [] })),
      ]);
      for (const it of (blog.items || [])) {
        const slug = unwrap(it.fields?.slug);
        if (!slug) continue;
        entries.push(urlEntry({
          loc: `${CFG.base}/resources/blog/${encodeURIComponent(slug)}/`,
          lastmod: fmtDate(unwrap(it.fields?.publishedDate) || it.sys?.updatedAt),
          changefreq: 'weekly',
          priority: '0.80',
        }));
      }
      for (const it of (cs.items || [])) {
        const slug = unwrap(it.fields?.adminSlug) || unwrap(it.fields?.slug);
        if (!slug) continue;
        entries.push(urlEntry({
          loc: `${CFG.base}/resources/case-studies/${encodeURIComponent(slug)}/`,
          lastmod: fmtDate(it.sys?.updatedAt),
          changefreq: 'monthly',
          priority: '0.75',
        }));
      }
      console.log(`Pulled ${blog.items?.length || 0} blog posts + ${cs.items?.length || 0} case studies from Contentful.`);
    } catch (e) {
      console.warn('Contentful fetch failed, falling back to static-only sitemap:', e.message);
    }
  } else {
    console.warn('CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN not set — sitemap will only include static URLs.');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
  const out = path.join(ROOT, 'sitemap.xml');
  fs.writeFileSync(out, xml, 'utf8');
  console.log(`Wrote ${entries.length} URLs to ${path.relative(ROOT, out)}`);
}

main().catch((e) => {
  console.error('Fatal:', e.stack || e.message);
  process.exit(1);
});
