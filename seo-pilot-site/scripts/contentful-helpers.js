/**
 * Shared helpers for Contentful (generate + preview-api).
 * Architecture: Page – Blog Post, Page – Case Study, Component – SEO, Content Block, Result Block.
 */

const { documentToHtmlString } = require('@contentful/rich-text-html-renderer');
const { BLOCKS } = require('@contentful/rich-text-types');

function unwrap(x) {
  if (x == null) return undefined;
  if (typeof x === 'object' && !Array.isArray(x) && x.constructor === Object) {
    const v = Object.values(x)[0];
    return v != null ? v : undefined;
  }
  return x;
}

function resolveEntry(id, includes) {
  const list = (includes && includes.Entry) || [];
  return list.find((e) => e.sys && e.sys.id === id) || null;
}

function resolveAsset(id, includes) {
  const list = (includes && includes.Asset) || [];
  return list.find((a) => a.sys && a.sys.id === id) || null;
}

function assetUrl(asset) {
  if (!asset || !asset.fields || !asset.fields.file) return '';
  const file = unwrap(asset.fields.file);
  const url = file && file.url;
  return url ? (url.startsWith('//') ? 'https:' + url : url) : '';
}

function richTextToHtml(doc, includes = {}) {
  if (!doc || !doc.content) return '';
  const options = {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const id = node.data?.target?.sys?.id;
        const asset = resolveAsset(id, includes);
        const url = assetUrl(asset);
        const title = unwrap(asset?.fields?.title) || '';
        return url ? `<img src="${url}" alt="${escapeAttr(title)}" loading="lazy" />` : '';
      },
      [BLOCKS.EMBEDDED_ENTRY]: (node) => {
        const id = node.data?.target?.sys?.id;
        const entry = resolveEntry(id, includes);
        if (!entry || !entry.fields) return '';
        const ct = entry.sys?.contentType?.sys?.id;
        if (ct === 'componentContentBlock') {
          const blockType = unwrap(entry.fields.blockType);
          const rich = unwrap(entry.fields.richText);
          const img = unwrap(entry.fields.image);
          const cap = unwrap(entry.fields.caption);
          const fullWidth = unwrap(entry.fields.fullWidth);
          let html = '';
          if (rich && rich.content) html = richTextToHtml(rich, includes);
          if (img) {
            const a = resolveAsset(img.sys?.id, includes);
            const u = assetUrl(a);
            if (u) html += `<figure><img src="${u}" alt="${escapeAttr(cap || '')}" loading="lazy" />${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}</figure>`;
          }
          const cls = fullWidth ? ' content-block content-block--full' : ' content-block';
          return html ? `<div class="${cls}">${html}</div>` : '';
        }
        return '';
      },
    },
  };
  try {
    return documentToHtmlString(doc, options);
  } catch (e) {
    return '';
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build HTML body from Page – Blog Post content blocks (references).
 * includes: { Entry: [], Asset: [] }
 */
function buildBodyFromContentBlocks(blockRefs, includes) {
  if (!Array.isArray(blockRefs)) return '';
  const ids = blockRefs.map((r) => (r && r.sys && r.sys.id) || (r && r.sys && r.sys.type === 'Link' ? r.sys.id : null)).filter(Boolean);
  const parts = [];
  for (const id of ids) {
    const entry = resolveEntry(id, includes);
    if (!entry || !entry.fields) continue;
    const rich = unwrap(entry.fields.richText);
    const img = unwrap(entry.fields.image);
    const caption = unwrap(entry.fields.caption);
    const fullWidth = unwrap(entry.fields.fullWidth);
    let html = '';
    if (rich && rich.content) html = richTextToHtml(rich, includes);
    if (img) {
      const assetId = img.sys && img.sys.id;
      const asset = assetId ? resolveAsset(assetId, includes) : null;
      const u = assetUrl(asset);
      if (u) html += `<figure><img src="${u}" alt="${escapeAttr(caption || '')}" loading="lazy" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
    }
    if (html) {
      const cls = fullWidth ? ' content-block content-block--full' : ' content-block';
      parts.push(`<div class="${cls}">${html}</div>`);
    }
  }
  return parts.join('\n');
}

/**
 * Extract SEO fields from resolved Component – SEO entry.
 */
function getSeo(seoEntry) {
  if (!seoEntry || !seoEntry.fields) return {};
  const f = seoEntry.fields;
  return {
    pageTitle: unwrap(f.pageTitle),
    pageDescription: unwrap(f.pageDescription),
    canonicalUrl: unwrap(f.canonicalUrl),
    noindex: unwrap(f.noindex),
    nofollow: unwrap(f.nofollow),
  };
}

/**
 * Build case study results HTML from Result Block refs.
 */
function buildResultsFromResultBlocks(refs, includes) {
  if (!Array.isArray(refs)) return '';
  const ids = refs.map((r) => (r && r.sys && r.sys.id) || null).filter(Boolean);
  const parts = [];
  for (const id of ids) {
    const entry = resolveEntry(id, includes);
    if (!entry || !entry.fields) continue;
    const label = unwrap(entry.fields.metricLabel);
    const value = unwrap(entry.fields.metricValue);
    const desc = unwrap(entry.fields.description);
    const img = unwrap(entry.fields.graphImage);
    let html = '';
    if (label || value) html += `<p class="result-metric"><strong>${escapeHtml(value || '')}</strong> ${escapeHtml(label || '')}</p>`;
    if (desc) html += `<p>${escapeHtml(desc)}</p>`;
    if (img && img.sys && img.sys.id) {
      const asset = resolveAsset(img.sys.id, includes);
      const u = assetUrl(asset);
      if (u) html += `<img src="${u}" alt="${escapeAttr(label || 'Result')}" class="results-graph" loading="lazy" />`;
    }
    if (html) parts.push(`<div class="result-block">${html}</div>`);
  }
  return parts.join('\n');
}

module.exports = {
  unwrap,
  resolveEntry,
  resolveAsset,
  assetUrl,
  richTextToHtml,
  escapeHtml,
  escapeAttr,
  buildBodyFromContentBlocks,
  getSeo,
  buildResultsFromResultBlocks,
};
