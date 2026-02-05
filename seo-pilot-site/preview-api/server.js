/**
 * Contentful Preview API proxy for blog preview.
 * Architecture: Page – Blog Post (content blocks, SEO reference).
 *
 * Env: CONTENTFUL_SPACE_ID, CONTENTFUL_PREVIEW_TOKEN
 * GET /api/preview?slug=xxx  or  ?id=xxx
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const {
  unwrap,
  resolveEntry,
  getSeo,
  getAuthor,
  getFeaturedImageUrl,
  formatPublishedDate,
  richTextToHtml,
  escapeHtml,
  escapeAttr,
} = require('./contentful-helpers');

const app = express();
const PORT = process.env.PORT || 3456;

const SPACE = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_PREVIEW_TOKEN;
const BLOG_CT = process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'pageBlogPost';
const PREVIEW_BASE = 'https://preview.contentful.com';

const ALLOW_ORIGINS = [
  'https://theseopilot.pro',
  'https://www.theseopilot.pro',
  'http://localhost:8000',
  'http://localhost:5500',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: (o, cb) => {
    if (!o || ALLOW_ORIGINS.some((a) => a === o)) return cb(null, true);
    if (o.startsWith('http://localhost:') || o.startsWith('http://127.0.0.1:')) return cb(null, true);
    cb(null, false);
  },
}));
app.use(express.json());

function resolveAuthorRef(entry, includes, items = []) {
  const f = entry.fields || {};
  const ref = unwrap(f.author);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

function resolveSeoRef(entry, includes, items = []) {
  const f = entry.fields || {};
  const ref = unwrap(f.seoFields) || unwrap(f.seo);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

app.get('/api/preview', async (req, res) => {
  const slug = (req.query.slug || '').trim();
  const id = (req.query.id || '').trim();

  if (!SPACE || !TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Preview API not configured (CONTENTFUL_SPACE_ID / CONTENTFUL_PREVIEW_TOKEN).',
    });
  }

  if (!slug && !id) {
    return res.status(400).json({
      ok: false,
      error: 'Provide ?slug=... or ?id=...',
    });
  }

  try {
    const q = new URLSearchParams({
      content_type: BLOG_CT,
      limit: '1',
      include: '10',
      locale: '*',
    });
    if (id) {
      q.set('sys.id', id);
    } else {
      q.set('fields.slug', slug);
    }
    const url = `${PREVIEW_BASE}/spaces/${SPACE}/environments/master/entries?${q}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({
        ok: false,
        error: `Contentful Preview API error: ${r.status}`,
        details: text.slice(0, 500),
      });
    }

    const data = await r.json();
    const items = data.items || [];
    const entry = items[0] || null;
    const includes = data.includes || {};

    if (!entry || !entry.fields) {
      return res.status(404).json({
        ok: false,
        error: 'Entry not found',
      });
    }

    const f = entry.fields;
    const title = unwrap(f.title) || 'Untitled';
    const subtitle = unwrap(f.subtitle) || '';
    const contentFieldIds = (process.env.CONTENTFUL_CONTENT_FIELD || 'content,body,mainContent,main_content').split(',').map((s) => s.trim()).filter(Boolean);
    let contentRich = null;
    for (const fid of contentFieldIds) {
      const val = unwrap(f[fid]);
      if (val && typeof val === 'object' && (val.nodeType === 'document' || Array.isArray(val.content))) {
        contentRich = val;
        break;
      }
    }
    const body = contentRich && contentRich.content ? richTextToHtml(contentRich, includes, items) : '';

    const faqsFieldIds = (process.env.CONTENTFUL_FAQS_FIELD || 'faqs').split(',').map((s) => s.trim()).filter(Boolean);
    let faqsRich = null;
    for (const fid of faqsFieldIds) {
      const val = unwrap(f[fid]);
      if (val && val.content && Array.isArray(val.content) && val.content.length > 0) {
        faqsRich = val;
        break;
      }
    }
    const faqsHtml = faqsRich && faqsRich.content && faqsRich.content.length
      ? `<section class="blog-faqs" aria-labelledby="faqs-heading"><h2 id="faqs-heading" class="faqs-heading">Frequently Asked Questions</h2><div class="faq-content blog-content">${richTextToHtml(faqsRich, includes, items)}</div></section>`
      : '';

    const featuredImageUrl = getFeaturedImageUrl(entry, includes);
    const featuredImageAbsolute = featuredImageUrl ? (featuredImageUrl.startsWith('//') ? 'https:' + featuredImageUrl : featuredImageUrl) : '';

    const publishedDateRaw = unwrap(f.publishedDate) || '';
    const publishedDateFormatted = formatPublishedDate(publishedDateRaw);

    const seoEntry = resolveSeoRef(entry, includes, items);
    const seo = getSeo(seoEntry);
    const seoTitle = seo.pageTitle || title;
    const seoDescription = seo.pageDescription || subtitle;

    const authorEntry = resolveAuthorRef(entry, includes, items);
    const author = getAuthor(authorEntry, includes);
    const authorHtml = author
      ? `<div class="blog-author"><div class="blog-author-inner">${author.avatarUrl ? `<img src="${escapeAttr(author.avatarUrl)}" alt="" class="blog-author-avatar" loading="lazy" />` : ''}<div><span class="blog-author-name">${escapeHtml(author.name)}</span>${author.roleCompany ? `<span class="blog-author-role">${escapeHtml(author.roleCompany)}</span>` : ''}${author.bio ? `<p class="blog-author-bio">${escapeHtml(author.bio)}</p>` : ''}</div></div></div>`
      : '';

    const post = {
      id: entry.sys?.id,
      title,
      slug: unwrap(f.slug) || entry.sys?.id,
      excerpt: subtitle,
      body: body || '',
      seoTitle,
      seoDescription,
      publishDate: publishedDateRaw,
      publishedDateFormatted,
      featuredImageUrl: featuredImageAbsolute,
      faqsHtml: faqsHtml || '',
      authorHtml: authorHtml || '',
    };

    return res.json({ ok: true, post });
  } catch (e) {
    console.error('Preview API error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'Preview fetch failed',
    });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Preview API listening on port ${PORT}`);
});
