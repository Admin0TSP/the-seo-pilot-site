#!/usr/bin/env node
/**
 * Generate Resources from Contentful.
 * Architecture: Page – Blog Post, Page – Case Study; Component – SEO, Content Block, Result Block.
 *
 * - Blog listing + /resources/blog/{slug}/
 * - Case studies listing + /resources/case-studies/{slug}/ (includes static Aspora)
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
${ogBlock}${schemaJson ? '\n' + schemaJson : ''}
  <script defer src="/script.js"></script>`;
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
  const ref = unwrap(f.seoFields) || unwrap(f.seo);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

function resolveAuthorRef(entry, includes, items = []) {
  const f = entry.fields || {};
  const ref = unwrap(f.author);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes, items) : null;
}

async function generateBlog(data) {
  const listing = data.items || [];
  const includes = data.includes || {};

  const listHtml = listing
    .map((it) => {
      const f = it.fields || {};
      const slug = unwrap(f.slug) || it.sys?.id || 'post';
      const title = unwrap(f.title) || 'Untitled';
      const subtitle = unwrap(f.subtitle) || '';
      const href = `/resources/blog/${encodeURIComponent(slug)}/`;
      return `
      <article>
        <h2><a href="${href}">${escapeHtml(title)}</a></h2>
        <p>${escapeHtml(subtitle)}</p>
        <a href="${href}">Read more →</a>
      </article>`;
    })
    .join('\n');

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
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / Blog
    </nav>
    <section class="page-hero">
      <div class="container">
        <h1>SEO & AI Visibility Insights</h1>
        <p>Practical guides on search visibility, Generative Engine Optimization, and content that ranks—and gets cited.</p>
      </div>
    </section>
    <div id="blogList" class="blog-list container">
      ${listHtml || `<p style="text-align:center;color:var(--muted);">No posts yet. Add <strong>Page – Blog Post</strong> entries in Contentful (content type: ${BLOG_CT}).</p>`}
    </div>
  </main>
${footer()}
</body>
</html>`;

  writeFile(path.join(ROOT, 'resources', 'blog', 'index.html'), blogIndex);

  const apiItems = data.items || [];
  for (const it of listing) {
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
    const body = contentRich && contentRich.content ? richTextToHtml(contentRich, includes, apiItems) : '';

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
      ? `<div class="blog-author"><div class="blog-author-inner">${author.avatarUrl ? `<img src="${escapeAttr(author.avatarUrl)}" alt="" class="blog-author-avatar" loading="lazy" />` : ''}<div><span class="blog-author-name">${escapeHtml(author.name)}</span>${author.roleCompany ? `<span class="blog-author-role">${escapeHtml(author.roleCompany)}</span>` : ''}${author.bio ? `<p class="blog-author-bio">${escapeHtml(author.bio)}</p>` : ''}</div></div></div>`
      : '';

    const featuredImageUrl = getFeaturedImageUrl(it, includes);
    const featuredImageAbsolute = featuredImageUrl ? (featuredImageUrl.startsWith('//') ? 'https:' + featuredImageUrl : featuredImageUrl) : '';

    const publishedDateRaw = unwrap(f.publishedDate) || '';
    const publishedDateFormatted = formatPublishedDate(publishedDateRaw);
    const publishedDateHtml = publishedDateFormatted ? `<time class="blog-published-date" datetime="${escapeAttr(publishedDateRaw)}">${escapeHtml(publishedDateFormatted)}</time>` : '';

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
      ? `<section class="blog-faqs" aria-labelledby="faqs-heading"><h2 id="faqs-heading" class="faqs-heading">Frequently Asked Questions</h2><div class="faq-content blog-content">${richTextToHtml(faqsRich, includes, apiItems)}</div></section>`
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

    const metaRow = [publishedDateHtml, authorHtml].filter(Boolean).join('');

    const postHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical, headOpts)}
</head>
<body>
${gtmBody()}
${header()}
  <main class="case-study-page blog-post-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / <a href="/resources/blog/">Blog</a> / ${escapeHtml(title)}
    </nav>
    <div class="container blog-post-container">
      <h1 class="blog-post-title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="blog-post-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${featuredImageAbsolute ? `<figure class="blog-featured-image"><img src="${escapeAttr(featuredImageAbsolute)}" alt="${escapeAttr(title)}" loading="eager" /></figure>` : ''}
      <div class="blog-meta-row">${metaRow}</div>
      <div class="legal-page blog-content-wrapper">
        <div class="blog-content">${body || '<p class="blog-content-empty">No content yet.</p>'}</div>
      </div>
      ${faqsHtml}
    </div>
  </main>
${footer()}
</body>
</html>`;

    const outDir = path.join(ROOT, 'resources', 'blog', slug);
    writeFile(path.join(outDir, 'index.html'), postHtml);
  }
}

async function generateCaseStudies(data) {
  const listing = data.items || [];
  const includes = data.includes || {};
  const cards = [];

  const aspora = {
    slug: 'aspora-ai-visibility',
    title: 'Aspora — From Rankings to AI Visibility',
    client: 'Aspora (aspora.com)',
    metric: '7.49M impressions · 89.1K clicks in 6 months',
  };
  cards.push(`      <div class="case-study-card">
        <a href="/resources/case-studies/aspora-ai-visibility/">
          <h2>${escapeHtml(aspora.title)}</h2>
          <p class="case-study-meta">Client: ${escapeHtml(aspora.client)}</p>
          <p class="case-study-metric">${escapeHtml(aspora.metric)}</p>
        </a>
      </div>`);

  for (const it of listing) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || it.sys?.id;
    if (!slug) continue;
    const clientName = unwrap(f.clientName) || 'Case Study';
    const industry = unwrap(f.industry) || '';
    const resultsBlocks = unwrap(f.resultsBlocks) || [];
    const firstResult = resultsBlocks[0];
    let metric = unwrap(f.keyMetrics) || '';
    if (!metric && firstResult && firstResult.sys && firstResult.sys.id) {
      const rb = resolveEntry(firstResult.sys.id, includes, data.items || []);
      if (rb && rb.fields) {
        const v = unwrap(rb.fields.metricValue);
        const l = unwrap(rb.fields.metricLabel);
        if (v || l) metric = [v, l].filter(Boolean).join(' ');
      }
    }
    const href = `/resources/case-studies/${encodeURIComponent(slug)}/`;
    cards.push(`      <div class="case-study-card">
        <a href="${href}">
          <h2>${escapeHtml(clientName)}</h2>
          <p class="case-study-meta">${industry ? escapeHtml(industry) + ' · ' : ''}Case study</p>
          <p class="case-study-metric">${escapeHtml(metric)}</p>
        </a>
      </div>`);
  }

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
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / Case Studies
    </nav>
    <section class="page-hero">
      <div class="container">
        <h1>Case Studies</h1>
        <p>Real results from real clients. Search growth, traffic lifts, and why AI started citing them.</p>
      </div>
    </section>
    <div class="container" style="padding: 2rem; max-width: 900px;">
${cards.join('\n')}
    </div>
  </main>
${footer()}
</body>
</html>`;

  writeFile(path.join(ROOT, 'resources', 'case-studies', 'index.html'), csIndex);

  for (const it of listing) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || it.sys?.id;
    if (!slug) continue;
    const clientName = unwrap(f.clientName) || 'Case Study';
    const challenge = unwrap(f.challenge) || '';
    const strategy = unwrap(f.strategy);
    const resultsBlocks = unwrap(f.resultsBlocks) || [];
    const resultsHtml = buildResultsFromResultBlocks(resultsBlocks, includes, data.items || []);

    let strategyHtml = '';
    if (strategy) {
      if (typeof strategy === 'object' && strategy.content) {
        strategyHtml = richTextToHtml(strategy, includes, data.items || []);
      } else {
        strategyHtml = escapeHtml(String(strategy));
      }
    }

    const seoEntry = resolveSeoRef(it, includes, data.items || []);
    const seo = getSeo(seoEntry, includes);
    const seoTitle = seo.pageTitle || clientName;
    const seoDescription = seo.pageDescription || (challenge ? challenge.replace(/<[^>]+>/g, '').slice(0, 160) + '…' : '');
    const canonical = seo.canonicalUrl || `${BASE}/resources/case-studies/${encodeURIComponent(slug)}/`;
    const seoShareImage = (seo.shareImages && seo.shareImages[0]) || '';

    const csHeadOpts = {};
    if (seoShareImage) csHeadOpts.ogImage = seoShareImage;
    if (seo.noindex) csHeadOpts.noindex = true;
    if (seo.nofollow) csHeadOpts.nofollow = true;

    const studyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical, csHeadOpts)}
</head>
<body>
${gtmBody()}
${header()}
  <main class="case-study-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / <a href="/resources/case-studies/">Case Studies</a> / ${escapeHtml(clientName)}
    </nav>
    <div class="container" style="padding-top:1rem;">
      <h1 style="margin-bottom:1rem;">${escapeHtml(clientName)}</h1>
      <section><h2>The Challenge</h2><div class="legal-page"><p>${escapeHtml(challenge)}</p></div></section>
      <section><h2>The Strategy</h2><div class="legal-page">${strategyHtml || ''}</div></section>
      <section><h2>The Results</h2><div class="legal-page">${resultsHtml || ''}</div></section>
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
  } catch (e) {
    console.error('Generate failed:', e.message);
    process.exit(1);
  }
}

main();
