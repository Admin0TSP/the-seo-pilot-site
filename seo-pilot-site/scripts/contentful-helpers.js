/**
 * Shared helpers for Contentful (generate + preview-api).
 * Architecture: Page – Blog Post (rich text content, faqs), Page – Case Study, Component – SEO, Result Block.
 */

const { documentToHtmlString } = require('@contentful/rich-text-html-renderer');
const { BLOCKS, INLINES } = require('@contentful/rich-text-types');

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

/** Resolve embedded entry from node - supports both link and pre-resolved target */
function resolveEmbeddedEntry(node, includes, items = []) {
  const target = node.data?.target;
  if (!target) return null;
  // Pre-resolved: target has fields (e.g. from SDK or transformed response)
  if (target.fields) return target;
  // Link: target has sys.id, resolve from includes/items
  const id = target.sys?.id;
  if (!id) return null;
  return resolveEntry(id, includes, items);
}

/** Render CTA block or rich content block from resolved entry */
function renderEmbeddedEntry(entry, includes, items = [], richTextToHtmlRef) {
  if (!entry || !entry.fields) return '';
  const ct = (entry.sys?.contentType?.sys?.id || entry.sys?.contentType?.id || '').toLowerCase();
  const blockTypeId = (process.env.CONTENTFUL_RICH_CONTENT_BLOCK_TYPE || 'richContentBlock').toLowerCase();
  const ctaTypeId = (process.env.CONTENTFUL_CTA_BLOCK_TYPE || 'ctaBlock').toLowerCase();

  if (ct === ctaTypeId) {
    const f = entry.fields;
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
      html = richTextToHtmlRef(rich, includes, items);
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
      [INLINES.EMBEDDED_ENTRY]: (node) => {
        // Inline embeds (e.g. CTA) rendered as block for visibility
        return renderEmbedded(node);
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

/**
 * Extract SEO fields from resolved Component – SEO entry.
 * @param {object} seoEntry - The resolved seoComponent entry
 * @param {object} includes - Contentful includes ({ Asset: [], Entry: [] }) for resolving shareImages
 * @returns {{ pageTitle, pageDescription, canonicalUrl, noindex, nofollow, shareImages: string[] }}
 */
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

/**
 * Extract FAQ pairs from Rich Text document for FAQPage schema.
 * Expects: heading (question) followed by paragraph(s) (answer).
 * Supports h2, h3, h4, h5, h6 as question headings.
 * @param {object} doc - Contentful Rich Text document
 * @returns {{ question: string, answer: string }[]}
 */
function extractFaqPairs(doc) {
  if (!doc || !doc.content || !Array.isArray(doc.content)) return [];
  const headingTypes = ['heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6'];
  const pairs = [];
  let currentQuestion = null;
  let currentAnswerParts = [];

  function textFromNode(node) {
    if (!node) return '';
    if (node.nodeType === 'text') return node.value || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(textFromNode).join('');
    }
    return '';
  }

  function flushPair() {
    if (currentQuestion && currentAnswerParts.length > 0) {
      pairs.push({
        question: currentQuestion.trim(),
        answer: currentAnswerParts.join(' ').trim(),
      });
    }
    currentQuestion = null;
    currentAnswerParts = [];
  }

  for (const node of doc.content) {
    const nodeType = node.nodeType;
    if (headingTypes.includes(nodeType)) {
      // Flush previous Q&A pair
      flushPair();
      // Start new question
      currentQuestion = textFromNode(node);
    } else if (nodeType === 'paragraph' || nodeType === 'unordered-list' || nodeType === 'ordered-list') {
      // Accumulate answer content
      if (currentQuestion) {
        currentAnswerParts.push(textFromNode(node));
      }
    }
    // Skip other node types (embedded entries, etc.) for FAQ extraction
  }
  // Flush last pair
  flushPair();

  return pairs;
}

/**
 * Build FAQPage schema from FAQ pairs.
 * @param {{ question: string, answer: string }[]} pairs
 * @returns {object|null} - FAQPage schema object or null if no pairs
 */
function buildFaqSchema(pairs) {
  if (!pairs || pairs.length === 0) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: p.answer,
      },
    })),
  };
}

/**
 * Format published date for display (e.g. "January 29, 2026").
 */
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

/**
 * Resolve featured image asset and return full URL.
 */
function getFeaturedImageUrl(entry, includes) {
  if (!entry || !entry.fields) return '';
  const img = unwrap(entry.fields.featuredImage) || unwrap(entry.fields.featured_image);
  if (!img || !img.sys || !img.sys.id) return '';
  const asset = resolveAsset(img.sys.id, includes);
  return assetUrl(asset);
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
  getSeo,
  getAuthor,
  getFeaturedImageUrl,
  formatPublishedDate,
  buildResultsFromResultBlocks,
  extractFaqPairs,
  buildFaqSchema,
};
