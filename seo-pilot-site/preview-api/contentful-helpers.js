/**
 * Contentful helpers for Preview API (Page – Blog Post, rich text content & faqs).
 */

const { documentToHtmlString } = require('@contentful/rich-text-html-renderer');
const { BLOCKS, INLINES } = require('@contentful/rich-text-types');

const RICH_BLOCK_TYPE = (process.env.CONTENTFUL_RICH_CONTENT_BLOCK_TYPE || 'richContentBlock').toLowerCase();
const CTA_TYPE = (process.env.CONTENTFUL_CTA_BLOCK_TYPE || 'ctaBlock').toLowerCase();

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

function blockTypeClass(blockType) {
  if (!blockType || typeof blockType !== 'string') return 'text';
  const t = blockType.toLowerCase().replace(/\s+/g, '-');
  return ['text', 'image', 'quote', 'list', 'code', 'cta'].includes(t) ? t : 'text';
}

function resolveEmbeddedEntry(node, includes, items = []) {
  const target = node.data?.target;
  if (!target) return null;
  if (target.fields) return target;
  const id = target.sys?.id;
  if (!id) return null;
  return resolveEntry(id, includes, items);
}

function renderEmbeddedEntry(entry, includes, items, richTextToHtmlRef) {
  if (!entry || !entry.fields) return '';
  const ct = (entry.sys?.contentType?.sys?.id || entry.sys?.contentType?.id || '').toLowerCase();
  const f = entry.fields;

  if (ct === CTA_TYPE) {
    const heading = unwrap(f.heading) || unwrap(f.headline) || '';
    const desc = unwrap(f.description) || unwrap(f.body) || '';
    const btn = unwrap(f.buttonText) || unwrap(f.button_label) || unwrap(f.ctaText) || 'Learn more';
    const url = unwrap(f.buttonUrl) || unwrap(f.button_url) || unwrap(f.ctaUrl) || unwrap(f.link) || '#';
    let h = '';
    if (heading) h += `<h3 class="cta-block-heading">${escapeHtml(heading)}</h3>`;
    if (desc) h += `<p class="cta-block-desc">${escapeHtml(desc)}</p>`;
    if (url && btn) h += `<a href="${escapeAttr(url)}" class="cta-btn">${escapeHtml(btn)}</a>`;
    return h ? `<div class="content-block content-block--cta">${h}</div>` : '';
  }
  if (ct === RICH_BLOCK_TYPE) {
    const rich = unwrap(f.richText) || unwrap(f.rich_text) || unwrap(f.body) || unwrap(f.content);
    const img = unwrap(f.image);
    const cap = unwrap(f.caption) || '';
    const fullWidth = unwrap(f.fullWidth) || unwrap(f.full_width);
    const blockType = unwrap(f.blockType) || unwrap(f.block_type);
    const typeClass = blockTypeClass(blockType);
    let html = '';
    if (rich && rich.content && Array.isArray(rich.content) && rich.content.length) html = richTextToHtmlRef(rich, includes, items);
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
}

function richTextToHtml(doc, includes = {}, items = []) {
  if (!doc || !doc.content) return '';
  const renderEmbedded = (node) => {
    const entry = resolveEmbeddedEntry(node, includes, items);
    return renderEmbeddedEntry(entry, includes, items, richTextToHtml);
  };
  const options = {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const id = node.data?.target?.sys?.id;
        const asset = resolveAsset(id, includes);
        const url = assetUrl(asset);
        const title = unwrap(asset?.fields?.title) || '';
        return url ? `<img src="${url}" alt="${escapeAttr(title)}" loading="lazy" />` : '';
      },
      [BLOCKS.EMBEDDED_ENTRY]: renderEmbedded,
      [INLINES.EMBEDDED_ENTRY]: renderEmbedded,
    },
  };
  try {
    return documentToHtmlString(doc, options);
  } catch (e) {
    return '';
  }
}

function getSeo(seoEntry, includes = {}) {
  if (!seoEntry || !seoEntry.fields) return {};
  const f = seoEntry.fields;
  const shareImagesRaw = unwrap(f.shareImages) || [];
  const shareImages = [];
  if (Array.isArray(shareImagesRaw)) {
    for (const img of shareImagesRaw) {
      const id = img && img.sys && img.sys.id;
      if (id) {
        const asset = resolveAsset(id, includes);
        const url = assetUrl(asset);
        if (url) shareImages.push(url);
      }
    }
  }
  return {
    pageTitle: unwrap(f.pageTitle),
    pageDescription: unwrap(f.pageDescription),
    canonicalUrl: unwrap(f.canonicalUrl),
    noindex: unwrap(f.noindex),
    nofollow: unwrap(f.nofollow),
    shareImages,
  };
}

function formatPublishedDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

function getFeaturedImageUrl(entry, includes) {
  if (!entry || !entry.fields) return '';
  const img = unwrap(entry.fields.featuredImage) || unwrap(entry.fields.featured_image);
  if (!img || !img.sys || !img.sys.id) return '';
  const asset = resolveAsset(img.sys.id, includes);
  return assetUrl(asset);
}

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
    avatarUrl: avatarUrl ? (avatarUrl.startsWith('//') ? 'https:' + avatarUrl : avatarUrl) : '',
    bio: unwrap(f.bio) || '',
    roleCompany: unwrap(f.roleCompany) || unwrap(f.role_company) || '',
  };
}

/**
 * Render content blocks from a reference array field (e.g. contentBlocks).
 */
function renderContentBlocks(refs, includes, items = []) {
  if (!Array.isArray(refs) || refs.length === 0) return '';
  const parts = [];
  for (const ref of refs) {
    const id = ref && ref.sys && ref.sys.id;
    if (!id) continue;
    const entry = resolveEntry(id, includes, items);
    if (!entry) continue;
    const html = renderEmbeddedEntry(entry, includes, items, richTextToHtml);
    if (html) parts.push(html);
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
  getSeo,
  getAuthor,
  getFeaturedImageUrl,
  formatPublishedDate,
  renderContentBlocks,
};
