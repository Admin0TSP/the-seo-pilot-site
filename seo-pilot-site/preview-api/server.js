/**
 * Contentful Preview API proxy for blog preview.
 * Fetches draft/unpublished entries from preview.contentful.com.
 *
 * Env: CONTENTFUL_SPACE_ID, CONTENTFUL_PREVIEW_TOKEN
 * GET /api/preview?slug=xxx  or  ?id=xxx
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3456;

const SPACE = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_PREVIEW_TOKEN;
const CONTENT_TYPE = process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'blogPost';
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

function env(name) {
  return process.env[name] || '';
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
    let url;
    if (id) {
      url = `${PREVIEW_BASE}/spaces/${SPACE}/environments/master/entries/${id}`;
    } else {
      const q = new URLSearchParams({
        content_type: CONTENT_TYPE,
        'fields.slug': slug,
        limit: '1',
      });
      url = `${PREVIEW_BASE}/spaces/${SPACE}/environments/master/entries?${q}`;
    }

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

    let entry;
    if (id) {
      entry = data;
    } else {
      const items = data.items || [];
      entry = items[0] || null;
    }

    if (!entry || !entry.fields) {
      return res.status(404).json({
        ok: false,
        error: 'Entry not found',
      });
    }

    const f = entry.fields;
    const v = (x) => {
      if (x == null) return undefined;
      if (typeof x === 'object' && !Array.isArray(x) && x.constructor === Object) {
        const first = Object.values(x)[0];
        return first != null ? first : undefined;
      }
      return x;
    };
    const title = v(f.title) || 'Untitled';
    const post = {
      id: entry.sys?.id,
      title,
      slug: v(f.slug) || entry.sys?.id,
      excerpt: v(f.excerpt) || '',
      body: v(f.body) || v(f.content) || '',
      seoTitle: v(f.seoTitle) || title,
      seoDescription: v(f.seoDescription) || v(f.excerpt) || '',
      publishDate: v(f.publishDate),
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
