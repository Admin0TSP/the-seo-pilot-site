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

function resolveEntry(id, includes, items = []) {
  const fromItems = Array.isArray(items) ? items : [];
  const fromIncludes = (includes && includes.Entry) || [];
  const list = [...fromItems, ...fromIncludes];
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
        const entry = resolveEntry(id, includes, []);
        if (!entry || !entry.fields) return '';
        const ct = entry.sys?.contentType?.sys?.id;
        const blockTypeId = process.env.CONTENTFUL_RICH_CONTENT_BLOCK_TYPE || 'richContentBlock';
        const ctaTypeId = process.env.CONTENTFUL_CTA_BLOCK_TYPE || 'ctaBlock';
        if (ct === blockTypeId) {
          const f = entry.fields;
          const rich = unwrap(f.richText) || unwrap(f.rich_text) || unwrap(f.body) || unwrap(f.content);
          const img = unwrap(f.image);
          const cap = unwrap(f.caption) || '';
          const fullWidth = unwrap(f.fullWidth) || unwrap(f.full_width);
          const blockType = unwrap(f.blockType) || unwrap(f.block_type);
          const typeClass = blockTypeClass(blockType);
          let html = '';
          if (rich && rich.content && Array.isArray(rich.content) && rich.content.length) {
            html = richTextToHtml(rich, includes);
          }
          if (img && img.sys && img.sys.id) {
            const a = resolveAsset(img.sys.id, includes);
            const u = assetUrl(a);
            if (u) html += `<figure class="content-block-figure"><img src="${u}" alt="${escapeAttr(cap)}" loading="lazy" />${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}</figure>`;
          }
          const base = 'content-block content-block--' + typeClass;
          const full = fullWidth ? ' content-block--full' : '';
          return html ? `<div class="${base}${full}">${html}</div>` : '';
        }
        if (ct === ctaTypeId) {
          const f = entry.fields;
          const heading = unwrap(f.heading) || '';
          const desc = unwrap(f.description) || '';
          const btn = unwrap(f.buttonText) || unwrap(f.button_label) || 'Learn more';
          const url = unwrap(f.buttonUrl) || unwrap(f.button_url) || '#';
          let h = '';
          if (heading) h += `<h3 class="cta-block-heading">${escapeHtml(heading)}</h3>`;
          if (desc) h += `<p class="cta-block-desc">${escapeHtml(desc)}</p>`;
          if (url && btn) h += `<a href="${escapeAttr(url)}" class="cta-btn">${escapeHtml(btn)}</a>`;
          return h ? `<div class="content-block content-block--cta">${h}</div>` : '';
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

/** Normalize block type for CSS class (text, image, quote, list, code, cta). */
function blockTypeClass(blockType) {
  if (!blockType || typeof blockType !== 'string') return 'text';
  const t = blockType.toLowerCase().replace(/\s+/g, '-');
  return ['text', 'image', 'quote', 'list', 'code', 'cta'].includes(t) ? t : 'text';
}

const CTA_TYPE = process.env.CONTENTFUL_CTA_BLOCK_TYPE || 'ctaBlock';
const RICH_BLOCK_TYPE = process.env.CONTENTFUL_RICH_CONTENT_BLOCK_TYPE || 'richContentBlock';

/**
 * Build HTML body from Page – Blog Post content blocks (references).
 * blockRefs: array of links { sys: { id } } or resolved entries.
 * includes: { Entry: [], Asset: [] }; items: optional entry array to also search when resolving.
 * Supports: richText/rich_text/body/content, blockType/block_type, CTA (heading, description, buttonText, buttonUrl).
 */
function buildBodyFromContentBlocks(blockRefs, includes, items = []) {
  if (!Array.isArray(blockRefs)) return '';
  const DEBUG = process.env.CONTENTFUL_DEBUG === '1' || process.env.CONTENTFUL_DEBUG === 'true';
  const parts = [];
  for (let i = 0; i < blockRefs.length; i++) {
    const r = blockRefs[i];
    const id = r && r.sys && r.sys.id ? r.sys.id : null;
    if (!id) continue;
    const isResolved = r.fields && r.sys && r.sys.type === 'Entry';
    const entry = isResolved ? r : resolveEntry(id, includes, items);
    if (!entry || !entry.fields) {
      if (DEBUG) console.warn(`[Contentful] Block ${i} id=${id} not resolved`);
      continue;
    }
    const ct = entry.sys?.contentType?.sys?.id;
    const f = entry.fields;

    if (ct === CTA_TYPE) {
      const heading = unwrap(f.heading) || '';
      const desc = unwrap(f.description) || '';
      const btn = unwrap(f.buttonText) || unwrap(f.button_label) || 'Learn more';
      const url = unwrap(f.buttonUrl) || unwrap(f.button_url) || '#';
      let h = '';
      if (heading) h += `<h3 class="cta-block-heading">${escapeHtml(heading)}</h3>`;
      if (desc) h += `<p class="cta-block-desc">${escapeHtml(desc)}</p>`;
      if (url && btn) h += `<a href="${escapeAttr(url)}" class="cta-btn">${escapeHtml(btn)}</a>`;
      if (h) parts.push(`<div class="content-block content-block--cta">${h}</div>`);
      continue;
    }

    if (ct !== RICH_BLOCK_TYPE) {
      if (DEBUG) console.warn(`[Contentful] Block ${i} id=${id} unknown type ${ct}, skip`);
      continue;
    }

    const rich = unwrap(f.richText) || unwrap(f.rich_text) || unwrap(f.body) || unwrap(f.content);
    const img = unwrap(f.image);
    const caption = unwrap(f.caption) || '';
    const fullWidth = unwrap(f.fullWidth) || unwrap(f.full_width);
    const blockType = unwrap(f.blockType) || unwrap(f.block_type);
    const typeClass = blockTypeClass(blockType);
    let html = '';
    if (rich && rich.content && Array.isArray(rich.content) && rich.content.length) {
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
  if (DEBUG && parts.length === 0 && blockRefs.length > 0) {
    console.warn('[Contentful] buildBodyFromContentBlocks: no blocks rendered', { blockRefsLength: blockRefs.length, includesEntryCount: (includes && includes.Entry && includes.Entry.length) || 0 });
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
 * Extract author fields from resolved Component – Author entry.
 * includes: { Asset: [] } for resolving avatar.
 */
function getAuthor(authorEntry, includes = {}) {
  if (!authorEntry || !authorEntry.fields) return null;
  const f = authorEntry.fields;
  const name = unwrap(f.name);
  if (!name) return null;
  const avatar = unwrap(f.avatar);
  let avatarUrl = '';
  if (avatar && avatar.sys && avatar.sys.id) {
    const asset = resolveAsset(avatar.sys.id, includes);
    avatarUrl = assetUrl(asset);
  }
  return {
    name,
    avatarUrl,
    bio: unwrap(f.bio) || '',
    roleCompany: unwrap(f.roleCompany) || unwrap(f.role_company) || '',
  };
}

/**
 * Build case study results HTML from Result Block refs.
 */
function buildResultsFromResultBlocks(refs, includes, items = []) {
  if (!Array.isArray(refs)) return '';
  const ids = refs.map((r) => (r && r.sys && r.sys.id) || null).filter(Boolean);
  const parts = [];
  for (const id of ids) {
    const entry = resolveEntry(id, includes, items);
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
  getAuthor,
  buildResultsFromResultBlocks,
};
