#!/usr/bin/env node
/**
 * Generate Resources from Contentful.
 * Architecture: Page – Blog Post, Page – Case Study; Component – SEO, Content Block, Result Block.
 *
 * - Blog listing + /resources/blog/{slug}/
 * - Case studies listing + /resources/case-studies/{slug}/ (100% Contentful-driven)
 *
 * Requires: CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN in .env
 * Run: npm run generate
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://theseopilot.pro';

const BLOG_CT = process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'pageBlogPost';
const CASE_STUDY_CT = process.env.CONTENTFUL_CASE_STUDY_CONTENT_TYPE || 'caseStudyPage';

const {
  unwrap,
  resolveEntry,
  escapeHtml,
  escapeAttr,
  getSeo,
  getAuthor,
  getFeaturedImageUrl,
  formatPublishedDate,
  buildResultsFromResultBlocks,
  richTextToHtml,
  extractFaqPairs,
  buildFaqSchema,
  renderContentBlocks,
} = require('./contentful-helpers');

function env(name) {
  return process.env[name] || '';
}

function loadDotenv() {
  try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
  } catch (_) {}
}

function nav() {
  return `
      <nav class="desktop-nav">
        <a href="/#services">Services</a>
        <a href="/#workflow">Process</a>
        <a href="/#about">About</a>
        <a href="/resources/">Resources</a>
        <a href="/#contact" class="nav-cta">Get Started</a>
      </nav>
      <div class="hamburger" onclick="toggleMenu()">☰</div>
    </div>
    <div class="mobile-nav" id="mobileNav">
      <a href="/#services">Services</a>
      <a href="/#workflow">Process</a>
      <a href="/#about">About</a>
      <a href="/resources/">Resources</a>
      <a href="/#contact">Get Started</a>
    </div>`;
}

function header() {
  return `  <header class="site-header">
    <div class="nav-container">
      <a href="/" class="nav-brand link-wrapper">
        <div class="nav-logo-circle-frame">
          <img src="/assets/img/logo-footer.webp" loading="lazy" alt="TheSEOPilot Logo" class="nav-logo" />
        </div>
        <div class="nav-logo">The<span class="logo-accent">SEO</span>Pilot</div>
      </a>${nav()}
  </header>`;
}

function footer() {
  return `  <footer class="site-footer">
    <div class="container footer-content">
      <div class="footer-brand">
        <div class="logo-circle-frame">
          <img src="/assets/img/logo-footer.webp" loading="lazy" alt="TheSEOPilot Logo" class="footer-logo" />
        </div>
        <div>
          <div class="nav-logo">The<span class="logo-accent">SEO</span>Pilot</div>
          <p>Your SEO Growth Partner.</p>
        </div>
      </div>
      <div class="footer-links">
        <h5>Legal</h5>
        <ul>
          <li><a href="/privacy/">Privacy</a></li>
          <li><a href="/terms/">Terms</a></li>
        </ul>
      </div>
    </div>
  </footer>
  <div class="copyright">
    <p>&copy; 2025 TheSEOPilot. All rights reserved.</p>
  </div>`;
}

function gtmHead() {
  return `  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-5ZTWCD2L');</script>
  <!-- End Google Tag Manager -->`;
}

function gtmBody() {
  return `  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5ZTWCD2L"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->`;
}

/** Safe JSON for embedding in script tag (escapes </script>) */
function safeSchemaJson(obj) {
  const s = JSON.stringify(obj);
  return s.replace(/<\//g, '<\\/');
}

function baseHead(title, description, canonical, opts = {}) {
  const ogTitle = opts.ogTitle || title;
  const ogDesc = (opts.ogDescription || description).slice(0, 200);
  const ogBlock = `  <meta property="og:title" content="${escapeAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeAttr(ogDesc)}" />
  <meta property="og:url" content="${escapeAttr(canonical)}" />
  <meta property="og:type" content="${opts.ogType || 'website'}" />${opts.ogImage ? `
  <meta property="og:image" content="${escapeAttr(opts.ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${escapeAttr(opts.ogImage)}" />` : `
  <meta name="twitter:card" content="summary" />`}
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeAttr(ogDesc)}" />`;
  const schemaJson = opts.schemaJson ? `  <script type="application/ld+json">${typeof opts.schemaJson === 'string' ? opts.schemaJson : safeSchemaJson(opts.schemaJson)}</script>` : '';
  // Robots meta: noindex/nofollow from SEO component
  const robotsParts = [];
  if (opts.noindex) robotsParts.push('noindex');
  if (opts.nofollow) robotsParts.push('nofollow');
  const robotsMeta = robotsParts.length ? `\n  <meta name="robots" content="${robotsParts.join(', ')}" />` : '';
  return `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${robotsMeta}
  <link rel="icon" href="/assets/img/favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="/flight-trail.css" />
  <link rel="stylesheet" href="/resources-design.css" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
${ogBlock}${schemaJson ? '\n' + schemaJson : ''}
  <script defer src="/script.js"></script>
  <script defer src="/flight-trail.js"></script>`;
}

async function fetchContentful(endpoint) {
  const space = env('CONTENTFUL_SPACE_ID');
  const token = env('CONTENTFUL_ACCESS_TOKEN');
  const url = `https://cdn.contentful.com/spaces/${space}/environments/master${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Contentful ${res.status}: ${await res.text()}`);
  return res.json();
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function resolveSeoRef(entry, includes, items = []) {
  const f = entry.fields || {};
  const ref = unwrap(f.seoFields) || unwrap(f.seo) || unwrap(f.ogSeoFields) || unwrap(f.og_seo_fields);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

function resolveAuthorRef(entry, includes, items = []) {
  const f = entry.fields || {};
  const ref = unwrap(f.author);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

/** Crumb component (white pill under hero) */
function crumb(parts) {
  // parts: [{ label, href? }, ...]
  const items = parts.map((p, i) => {
    const sep = i > 0 ? '<span class="rx-crumb__sep">›</span>' : '';
    if (p.href) {
      return `${sep}<a href="${escapeAttr(p.href)}">${escapeHtml(p.label)}</a>`;
    }
    return `${sep}<span>${escapeHtml(p.label)}</span>`;
  }).join('');
  return `    <div class="rx-crumb__wrap">
      <nav class="rx-crumb" aria-label="Breadcrumb">${items}</nav>
    </div>`;
}

/** Hero block — gold-accent runway grid */
function rxHero(eyebrow, titleHtml, subtitle, meta) {
  const metaHtml = meta ? `<div class="rx-hero__meta">${meta}</div>` : '';
  return `    <section class="rx-hero">
      <div class="rx-hero__inner">
        <span class="rx-eyebrow"><span class="rx-eyebrow__dot"></span>${escapeHtml(eyebrow)}</span>
        <h1 class="rx-hero__title">${titleHtml}</h1>
        <p class="rx-hero__subtitle">${escapeHtml(subtitle)}</p>
        ${metaHtml}
      </div>
    </section>`;
}

/** Format ISO date as YYYY · MMM */
function formatLogDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const m = d.toLocaleString('en-US', { month: 'short' });
  return `${d.getFullYear()} · ${m.toUpperCase()}`;
}

async function generateBlog(data) {
  const listing = data.items || [];
  const includes = data.includes || {};

  // Sort newest first by publishedDate (Contentful already orders, but keep deterministic)
  const sortedListing = [...listing].sort((a, b) => {
    const da = new Date(unwrap(a.fields?.publishedDate) || a.sys?.updatedAt || 0).getTime();
    const db = new Date(unwrap(b.fields?.publishedDate) || b.sys?.updatedAt || 0).getTime();
    return db - da;
  });

  const rows = sortedListing
    .map((it) => {
      const f = it.fields || {};
      const slug = unwrap(f.slug) || it.sys?.id || 'post';
      const title = unwrap(f.title) || 'Untitled';
      const subtitle = unwrap(f.subtitle) || '';
      const date = formatLogDate(unwrap(f.publishedDate) || it.sys?.updatedAt);
      const href = `/resources/blog/${encodeURIComponent(slug)}/`;
      return `        <a class="rx-log__row" href="${href}">
          <span class="rx-log__date">${escapeHtml(date)}</span>
          <div class="rx-log__body">
            <h2 class="rx-log__title">${escapeHtml(title)}</h2>
            ${subtitle ? `<p class="rx-log__sub">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <span class="rx-log__cta">Read →</span>
        </a>`;
    })
    .join('\n');

  const emptyRow = `        <div class="rx-log__empty">No flight logs yet. Add <strong>Page – Blog Post</strong> entries in Contentful (content type: ${escapeHtml(BLOG_CT)}).</div>`;

  const blogIndex = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead('Blog — SEO & GEO Insights | TheSEOPilot', 'SEO and Generative Engine Optimization insights. How to rank, get cited by AI, and grow organic visibility.', BASE + '/resources/blog/')}
</head>
<body>
${gtmBody()}
${header()}
  <main>
${rxHero('Flight Logs', 'SEO &amp; <em>AI Visibility</em> Insights', 'Practical guides on search visibility, Generative Engine Optimization, and content that ranks — and gets cited.', `<span>${sortedListing.length.toString().padStart(2,'0')} ENTRIES</span><span class="rx-hero__meta-divider"></span><span>Updated weekly</span>`)}
${crumb([{label:'Home',href:'/'},{label:'Resources',href:'/resources/'},{label:'Blog'}])}
    <div class="rx-log" data-fp-stagger>
      <div class="rx-log__head">
        <span>Date</span>
        <span>Title</span>
        <span style="text-align:right;">Action</span>
      </div>
${rows || emptyRow}
    </div>
  </main>
${footer()}
</body>
</html>`;

  writeFile(path.join(ROOT, 'resources', 'blog', 'index.html'), blogIndex);

  const apiItems = data.items || [];
  for (const it of sortedListing) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || it.sys?.id || 'post';
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
    const bodyRichText = contentRich && contentRich.content ? richTextToHtml(contentRich, includes, apiItems) : '';

    // Render content blocks from contentBlocks reference field (CTA blocks, rich content blocks, etc.)
    const contentBlocksFieldIds = (process.env.CONTENTFUL_CONTENT_BLOCKS_FIELD || 'contentBlocks,content_blocks,blocks').split(',').map((s) => s.trim()).filter(Boolean);
    let contentBlocksRefs = null;
    for (const fid of contentBlocksFieldIds) {
      const val = unwrap(f[fid]);
      if (Array.isArray(val) && val.length > 0) {
        contentBlocksRefs = val;
        break;
      }
    }
    const contentBlocksHtml = contentBlocksRefs ? renderContentBlocks(contentBlocksRefs, includes, apiItems) : '';

    // Combine: rich text content first, then content blocks
    const body = [bodyRichText, contentBlocksHtml].filter(Boolean).join('\n');

    if (process.env.CONTENTFUL_DEBUG && !body) {
      const fieldKeys = Object.keys(f);
      console.warn(`[Contentful] Blog "${title}" (${slug}): no content rendered. Fields on entry: ${fieldKeys.join(', ')}. Check that "content" (or body/mainContent) Rich Text has content and is published.`);
    }

    const seoEntry = resolveSeoRef(it, includes, apiItems);
    const seo = getSeo(seoEntry, includes);
    const seoTitle = seo.pageTitle || title;
    const seoDescription = seo.pageDescription || subtitle;
    const canonical = seo.canonicalUrl || `${BASE}/resources/blog/${encodeURIComponent(slug)}/`;
    const seoShareImage = (seo.shareImages && seo.shareImages[0]) || '';

    const authorEntry = resolveAuthorRef(it, includes, apiItems);
    const author = getAuthor(authorEntry, includes);
    const authorHtml = author
      ? `<div class="rx-article__author">${author.avatarUrl ? `<img src="${escapeAttr(author.avatarUrl)}" alt="" loading="lazy" />` : ''}<span class="rx-article__author-name">${escapeHtml(author.name)}</span></div>`
      : '';

    const featuredImageUrl = getFeaturedImageUrl(it, includes);
    const featuredImageAbsolute = featuredImageUrl ? (featuredImageUrl.startsWith('//') ? 'https:' + featuredImageUrl : featuredImageUrl) : '';

    const publishedDateRaw = unwrap(f.publishedDate) || '';
    const publishedDateFormatted = formatPublishedDate(publishedDateRaw);
    const publishedDateHtml = publishedDateFormatted ? `<time datetime="${escapeAttr(publishedDateRaw)}">${escapeHtml(publishedDateFormatted)}</time>` : '';

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
      ? `<section class="rx-faq" aria-labelledby="faqs-heading"><h2 id="faqs-heading" class="rx-faq__title">Frequently Asked Questions</h2><div class="blog-content rx-article__body">${richTextToHtml(faqsRich, includes, apiItems)}</div></section>`
      : '';

    // Extract FAQ pairs for FAQPage schema
    const faqPairs = faqsRich ? extractFaqPairs(faqsRich) : [];
    const faqSchema = buildFaqSchema(faqPairs);

    const headOpts = { ogType: 'article' };
    // Image priority: featuredImage > seoComponent shareImages[0]
    const ogImageUrl = featuredImageAbsolute || seoShareImage;
    if (ogImageUrl) headOpts.ogImage = ogImageUrl;
    // Robots directives from SEO component
    if (seo.noindex) headOpts.noindex = true;
    if (seo.nofollow) headOpts.nofollow = true;

    const schemaGraph = [
      {
        '@type': 'Article',
        headline: title,
        description: seoDescription,
        url: canonical,
        datePublished: publishedDateRaw || undefined,
        dateModified: publishedDateRaw || undefined,
        author: author ? { '@type': 'Person', name: author.name } : { '@type': 'Organization', name: 'TheSEOPilot' },
        publisher: { '@type': 'Organization', name: 'TheSEOPilot', logo: { '@type': 'ImageObject', url: BASE + '/assets/img/logo-footer.webp' } },
        ...(ogImageUrl && { image: ogImageUrl }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Resources', item: BASE + '/resources/' },
          { '@type': 'ListItem', position: 3, name: 'Blog', item: BASE + '/resources/blog/' },
          { '@type': 'ListItem', position: 4, name: title, item: canonical },
        ],
      },
    ];
    // Add FAQPage schema if FAQ pairs exist
    if (faqSchema) {
      schemaGraph.push(faqSchema);
    }
    const articleSchema = {
      '@context': 'https://schema.org',
      '@graph': schemaGraph,
    };
    headOpts.schemaJson = articleSchema;

    const metaParts = [];
    if (publishedDateHtml) metaParts.push(publishedDateHtml);
    if (authorHtml) metaParts.push(authorHtml);
    const metaJoined = metaParts.join('<span class="rx-article__meta-dot"></span>');

    const postHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical, headOpts)}
</head>
<body>
${gtmBody()}
${header()}
  <main>
${crumb([{label:'Home',href:'/'},{label:'Resources',href:'/resources/'},{label:'Blog',href:'/resources/blog/'},{label:title}])}
    <article class="rx-article">
      <header class="rx-article__head">
        <span class="rx-article__kicker">Field Notes</span>
        <h1 class="rx-article__title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="rx-article__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        ${metaJoined ? `<div class="rx-article__meta">${metaJoined}</div>` : ''}
      </header>
      ${featuredImageAbsolute ? `<figure class="rx-article__featured"><img src="${escapeAttr(featuredImageAbsolute)}" alt="${escapeAttr(title)}" loading="eager" /></figure>` : ''}
      <div class="rx-article__body blog-content">${body || '<p style="color:var(--rx-mute);font-style:italic;">No content yet.</p>'}</div>
    </article>
    ${faqsHtml}
  </main>
${footer()}
</body>
</html>`;

    const outDir = path.join(ROOT, 'resources', 'blog', slug);
    writeFile(path.join(outDir, 'index.html'), postHtml);
  }
}

/**
 * Try to surface up to N "headline" metrics from a case study entry for the
 * mission report dashboard. Sources, in order: keyMetrics JSON, Result Block refs.
 */
function buildCaseStudyMetrics(entry, includes, items = []) {
  const f = entry.fields || {};
  const results = [];

  // 1. keyMetrics JSON ({ "label": "value" } or [{label, value}])
  const km = unwrap(f.keyMetrics) || unwrap(f.key_metrics);
  if (km && typeof km === 'object') {
    if (Array.isArray(km)) {
      for (const item of km) {
        if (!item) continue;
        if (typeof item === 'object') {
          const label = item.label || item.metricLabel || item.name || '';
          const value = item.value || item.metricValue || item.amount || '';
          if (label || value) results.push({ label: String(label), value: String(value) });
        }
      }
    } else {
      for (const [label, value] of Object.entries(km)) {
        if (value == null) continue;
        results.push({ label: String(label), value: String(value) });
      }
    }
  }

  // 2. Result Block references (legacy / supplementary)
  if (results.length < 3) {
    const refs = unwrap(f.resultsBlocks) || unwrap(f.results_blocks) || [];
    if (Array.isArray(refs)) {
      for (const ref of refs) {
        const id = ref && ref.sys && ref.sys.id;
        if (!id) continue;
        const rb = resolveEntry(id, includes, items);
        if (!rb || !rb.fields) continue;
        const label = unwrap(rb.fields.metricLabel) || unwrap(rb.fields.metric_label) || '';
        const value = unwrap(rb.fields.metricValue) || unwrap(rb.fields.metric_value) || '';
        if (label || value) results.push({ label: String(label), value: String(value) });
        if (results.length >= 4) break;
      }
    }
  }

  return results.slice(0, 4);
}

/** Render a rich-text or plain-text field as HTML. */
function renderRichOrText(val, includes, items) {
  if (!val) return '';
  if (typeof val === 'string') return `<p>${escapeHtml(val)}</p>`;
  if (typeof val === 'object' && (val.nodeType === 'document' || Array.isArray(val.content))) {
    return richTextToHtml(val, includes, items);
  }
  return '';
}

async function generateCaseStudies(data) {
  const listing = data.items || [];
  const includes = data.includes || {};
  const apiItems = data.items || [];

  const cards = [];

  // Sort by updatedAt desc (Contentful returns this order already, but be explicit).
  const sorted = [...listing].sort((a, b) => {
    const da = new Date(a.sys?.updatedAt || 0).getTime();
    const db = new Date(b.sys?.updatedAt || 0).getTime();
    return db - da;
  });

  for (const it of sorted) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || unwrap(f.adminSlug) || it.sys?.id;
    if (!slug) continue;
    const clientName = unwrap(f.clientName) || unwrap(f.client_name) || 'Case Study';
    const h1 = unwrap(f.h1) || '';
    const industry = unwrap(f.industry) || '';
    const timeframe = unwrap(f.contextTimeframe) || unwrap(f.context_timeframe) || '';
    const metrics = buildCaseStudyMetrics(it, includes, apiItems);
    const topMetric = metrics[0];

    const href = `/resources/case-studies/${encodeURIComponent(slug)}/`;
    const displayTitle = h1 || clientName;
    cards.push(`        <a class="rx-mission" href="${href}">
          <div class="rx-mission__top">
            <span class="rx-mission__industry">${escapeHtml(industry || 'Case Study')}</span>
            ${timeframe ? `<span class="rx-mission__timeframe">${escapeHtml(timeframe)}</span>` : ''}
          </div>
          <h2 class="rx-mission__title">${escapeHtml(displayTitle)}</h2>
          <p class="rx-mission__client">${escapeHtml(clientName)}</p>
          ${topMetric ? `<div class="rx-mission__metric">
            <span class="rx-mission__metric-value">${escapeHtml(topMetric.value || '')}</span>
            <span class="rx-mission__metric-label">${escapeHtml(topMetric.label || '')}</span>
          </div>` : ''}
          <span class="rx-mission__cta">Read mission report</span>
        </a>`);
  }

  const emptyCards = `        <div class="rx-log__empty">No mission reports yet. Add <strong>Page – Case Study</strong> entries in Contentful (content type: ${escapeHtml(CASE_STUDY_CT)}).</div>`;

  const csIndex = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead('Case Studies | TheSEOPilot', 'Real SEO and GEO results. Traffic growth, rankings, and why AI started citing our clients.', BASE + '/resources/case-studies/')}
</head>
<body>
${gtmBody()}
${header()}
  <main>
${rxHero('Mission Reports', 'Search growth, <em>measured</em>.', 'Real results from real clients. Traffic lifts, rankings, and why AI started citing them.', `<span>${sorted.length.toString().padStart(2,'0')} REPORTS</span><span class="rx-hero__meta-divider"></span><span>Filed from the field</span>`)}
${crumb([{label:'Home',href:'/'},{label:'Resources',href:'/resources/'},{label:'Case Studies'}])}
    <div class="rx-missions" data-fp-stagger>
${cards.join('\n') || emptyCards}
    </div>
  </main>
${footer()}
</body>
</html>`;

  writeFile(path.join(ROOT, 'resources', 'case-studies', 'index.html'), csIndex);

  for (const it of sorted) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || unwrap(f.adminSlug) || it.sys?.id;
    if (!slug) continue;
    const clientName = unwrap(f.clientName) || unwrap(f.client_name) || 'Case Study';
    const h1 = unwrap(f.h1) || '';
    const industry = unwrap(f.industry) || '';
    const timeframe = unwrap(f.contextTimeframe) || unwrap(f.context_timeframe) || '';

    const challenge = unwrap(f.challenge);
    const strategy = unwrap(f.strategy);
    // New schema: 'result' (singular, Rich text). Backward compat: results (rich) or resultsBlocks (refs).
    const resultsRich = unwrap(f.result) || unwrap(f.results);
    const purpose = unwrap(f.purpose);

    const challengeHtml = renderRichOrText(challenge, includes, apiItems);
    const strategyHtml = renderRichOrText(strategy, includes, apiItems);
    let resultsHtml = renderRichOrText(resultsRich, includes, apiItems);
    if (!resultsHtml) {
      // Fallback: legacy reference array
      const legacyRefs = unwrap(f.resultsBlocks) || unwrap(f.results_blocks);
      if (Array.isArray(legacyRefs)) {
        resultsHtml = buildResultsFromResultBlocks(legacyRefs, includes, apiItems);
      }
    }
    const purposeHtml = renderRichOrText(purpose, includes, apiItems);

    const metrics = buildCaseStudyMetrics(it, includes, apiItems);

    const featuredImageUrl = getFeaturedImageUrl(it, includes);
    const featuredImageAbsolute = featuredImageUrl ? (featuredImageUrl.startsWith('//') ? 'https:' + featuredImageUrl : featuredImageUrl) : '';

    const seoEntry = resolveSeoRef(it, includes, apiItems);
    const seo = getSeo(seoEntry, includes);
    const seoTitle = seo.pageTitle || h1 || clientName;
    const challengePlain = challengeHtml ? challengeHtml.replace(/<[^>]+>/g, '').slice(0, 160) : '';
    const seoDescription = seo.pageDescription || (challengePlain ? challengePlain + '…' : `Case study: ${clientName}`);
    const canonical = seo.canonicalUrl || `${BASE}/resources/case-studies/${encodeURIComponent(slug)}/`;
    const seoShareImage = (seo.shareImages && seo.shareImages[0]) || featuredImageAbsolute;

    const csHeadOpts = { ogType: 'article' };
    if (seoShareImage) csHeadOpts.ogImage = seoShareImage;
    if (seo.noindex) csHeadOpts.noindex = true;
    if (seo.nofollow) csHeadOpts.nofollow = true;

    // Schema.org Article + BreadcrumbList
    const csSchema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: h1 || clientName,
          description: seoDescription,
          url: canonical,
          dateModified: it.sys?.updatedAt || undefined,
          author: { '@type': 'Organization', name: 'TheSEOPilot' },
          publisher: { '@type': 'Organization', name: 'TheSEOPilot', logo: { '@type': 'ImageObject', url: BASE + '/assets/img/logo-footer.webp' } },
          ...(seoShareImage && { image: seoShareImage }),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
            { '@type': 'ListItem', position: 2, name: 'Resources', item: BASE + '/resources/' },
            { '@type': 'ListItem', position: 3, name: 'Case Studies', item: BASE + '/resources/case-studies/' },
            { '@type': 'ListItem', position: 4, name: h1 || clientName, item: canonical },
          ],
        },
      ],
    };
    csHeadOpts.schemaJson = csSchema;

    const metricsHtml = metrics.length
      ? `<div class="rx-mr__metrics">${metrics.map((m) => `<div class="rx-mr__metric"><span class="rx-mr__metric-value">${escapeHtml(m.value || '')}</span><span class="rx-mr__metric-label">${escapeHtml(m.label || '')}</span></div>`).join('')}</div>`
      : '';

    const tagsHtml = `<div class="rx-mr__tags">
        ${industry ? `<span class="rx-mr__tag">${escapeHtml(industry)}</span>` : ''}
        ${timeframe ? `<span class="rx-mr__tag rx-mr__tag--muted">${escapeHtml(timeframe)}</span>` : ''}
      </div>`;

    const sections = [];
    if (purposeHtml) {
      sections.push(`      <section class="rx-mr__section"><span class="rx-mr__label">Purpose</span><div class="rx-mr__body">${purposeHtml}</div></section>`);
    }
    if (challengeHtml) {
      sections.push(`      <section class="rx-mr__section"><span class="rx-mr__label">The Challenge</span><h2 class="rx-mr__heading">What we were up against</h2><div class="rx-mr__body">${challengeHtml}</div></section>`);
    }
    if (strategyHtml) {
      sections.push(`      <section class="rx-mr__section"><span class="rx-mr__label">The Strategy</span><h2 class="rx-mr__heading">How we flew the route</h2><div class="rx-mr__body">${strategyHtml}</div></section>`);
    }
    if (resultsHtml) {
      sections.push(`      <section class="rx-mr__section"><span class="rx-mr__label">The Results</span><h2 class="rx-mr__heading">Where we landed</h2><div class="rx-mr__body">${resultsHtml}</div></section>`);
    }

    const studyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical, csHeadOpts)}
</head>
<body>
${gtmBody()}
${header()}
  <main>
${crumb([{label:'Home',href:'/'},{label:'Resources',href:'/resources/'},{label:'Case Studies',href:'/resources/case-studies/'},{label:clientName}])}
    <div class="rx-mr">
      <header class="rx-mr__head">
        <div class="rx-mr__head-inner">
          ${tagsHtml}
          <h1 class="rx-mr__title">${escapeHtml(h1 || clientName)}</h1>
          <p class="rx-mr__client">Client · ${escapeHtml(clientName)}</p>
          ${metricsHtml}
        </div>
      </header>
      ${featuredImageAbsolute ? `<figure class="rx-article__featured" style="margin-bottom:2.5rem;"><img src="${escapeAttr(featuredImageAbsolute)}" alt="${escapeAttr(clientName)}" loading="eager" /></figure>` : ''}
${sections.join('\n')}
    </div>
  </main>
${footer()}
</body>
</html>`;

    const outDir = path.join(ROOT, 'resources', 'case-studies', slug);
    writeFile(path.join(outDir, 'index.html'), studyHtml);
  }
}

async function main() {
  loadDotenv();
  const space = env('CONTENTFUL_SPACE_ID');
  const token = env('CONTENTFUL_ACCESS_TOKEN');

  if (!space || !token) {
    console.log('Contentful not configured (CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN). Skip generate.');
    process.exit(0);
  }

  try {
    const [blogRes, csRes] = await Promise.all([
      fetchContentful(`/entries?content_type=${BLOG_CT}&order=-fields.publishedDate&include=10&locale=*`),
      fetchContentful(`/entries?content_type=${CASE_STUDY_CT}&order=-sys.updatedAt&include=5&locale=*`).catch(() => ({ items: [], includes: {} })),
    ]);
    await generateBlog(blogRes);
    await generateCaseStudies(csRes);
    const nBlog = (blogRes.items || []).length;
    const nCs = (csRes.items || []).length;
    console.log(`Generated Resources: ${nBlog} blog posts, ${nCs} case studies.`);
    if (nBlog === 0) {
      console.warn(`No Page – Blog Post entries found. Check that CONTENTFUL_BLOG_CONTENT_TYPE (${BLOG_CT}) matches your content type API ID in Contentful.`);
    }
    if (nCs === 0) {
      console.warn(`No Page – Case Study entries found. Check that CONTENTFUL_CASE_STUDY_CONTENT_TYPE (${CASE_STUDY_CT}) matches your content type API ID in Contentful.`);
    }
  } catch (e) {
    console.error('Generate failed:', e.message);
    process.exit(1);
  }
}

main();
