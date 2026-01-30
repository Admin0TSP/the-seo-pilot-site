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
        const blockTypeId = process.env.CONTENTFUL_RICH_CONTENT_BLOCK_TYPE || 'richContentBlock';
        if (ct === blockTypeId) {
          const f = entry.fields;
          const rich = unwrap(f.richText) || unwrap(f.rich_text);
          const img = unwrap(f.image);
          const cap = unwrap(f.caption) || '';
          const fullWidth = unwrap(f.fullWidth) || unwrap(f.full_width);
          const blockType = unwrap(f.blockType) || unwrap(f.block_type);
          const typeClass = blockTypeClass(blockType);
          let html = '';
          if (rich && rich.content && Array.isArray(rich.content)) html = richTextToHtml(rich, includes);
          if (img && img.sys && img.sys.id) {
            const a = resolveAsset(img.sys.id, includes);
            const u = assetUrl(a);
            if (u) html += `<figure class="content-block-figure"><img src="${u}" alt="${escapeAttr(cap)}" loading="lazy" />${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}</figure>`;
          }
          const base = 'content-block content-block--' + typeClass;
          const full = fullWidth ? ' content-block--full' : '';
          return html ? `<div class="${base}${full}">${html}</div>` : '';
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

/** Normalize block type for CSS class (text, image, quote, list, code). */
function blockTypeClass(blockType) {
  if (!blockType || typeof blockType !== 'string') return 'text';
  const t = blockType.toLowerCase().replace(/\s+/g, '-');
  return ['text', 'image', 'quote', 'list', 'code'].includes(t) ? t : 'text';
}

/**
 * Build HTML body from Page – Blog Post content blocks (references).
 * includes: { Entry: [], Asset: [] }
 * Supports field IDs: richText/rich_text, image, caption, fullWidth/full_width, blockType/block_type.
 */
function buildBodyFromContentBlocks(blockRefs, includes) {
  if (!Array.isArray(blockRefs)) return '';
  const ids = blockRefs.map((r) => (r && r.sys && r.sys.id) || null).filter(Boolean);
  const parts = [];
  for (const id of ids) {
    const entry = resolveEntry(id, includes);
    if (!entry || !entry.fields) continue;
    const f = entry.fields;
    const rich = unwrap(f.richText) || unwrap(f.rich_text);
    const img = unwrap(f.image);
    const caption = unwrap(f.caption) || '';
    const fullWidth = unwrap(f.fullWidth) || unwrap(f.full_width);
    const blockType = unwrap(f.blockType) || unwrap(f.block_type);
    const typeClass = blockTypeClass(blockType);
    let html = '';
    if (rich && rich.content && Array.isArray(rich.content)) {
      html = richTextToHtml(rich, includes);
    }
    if (img && img.sys && img.sys.id) {
      const asset = resolveAsset(img.sys.id, includes);
      const u = assetUrl(asset);
      if (u) {
        html += `<figure class="content-block-figure"><img src="${u}" alt="${escapeAttr(caption)}" loading="lazy" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
      }
    }
    if (html) {
      const base = 'content-block content-block--' + typeClass;
      const full = fullWidth ? ' content-block--full' : '';
      parts.push(`<div class="${base}${full}">${html}</div>`);
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
  blockTypeClass,
  buildBodyFromContentBlocks,
  getSeo,
  buildResultsFromResultBlocks,
};
