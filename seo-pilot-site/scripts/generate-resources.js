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
const CASE_STUDY_CT = process.env.CONTENTFUL_CASE_STUDY_CONTENT_TYPE || 'pageCaseStudy';

const {
  unwrap,
  resolveEntry,
  resolveAsset,
  assetUrl,
  escapeHtml,
  buildBodyFromContentBlocks,
  getSeo,
  buildResultsFromResultBlocks,
  richTextToHtml,
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

function baseHead(title, description, canonical) {
  return `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="icon" href="/assets/img/favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="/style.css" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
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

function resolveSeoRef(entry, includes) {
  const f = entry.fields || {};
  const ref = unwrap(f.seoFields) || unwrap(f.seo);
  const id = ref && ref.sys && ref.sys.id;
  return id ? resolveEntry(id, includes) : null;
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

  for (const it of listing) {
    const f = it.fields || {};
    const slug = unwrap(f.slug) || it.sys?.id || 'post';
    const title = unwrap(f.title) || 'Untitled';
    const subtitle = unwrap(f.subtitle) || '';
    const blocks = unwrap(f.contentBlocks) || [];
    const body = buildBodyFromContentBlocks(blocks, includes);

    const seoEntry = resolveSeoRef(it, includes);
    const seo = getSeo(seoEntry);
    const seoTitle = seo.pageTitle || title;
    const seoDescription = seo.pageDescription || subtitle;
    const canonical = seo.canonicalUrl || `${BASE}/resources/blog/${encodeURIComponent(slug)}/`;

    const postHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical)}
</head>
<body>
${gtmBody()}
${header()}
  <main class="case-study-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / <a href="/resources/blog/">Blog</a> / ${escapeHtml(title)}
    </nav>
    <div class="container" style="padding-top:1rem;">
      <h1 style="margin-bottom:0.5rem;">${escapeHtml(title)}</h1>
      ${subtitle ? `<p style="color:var(--muted);margin-bottom:1.5rem;">${escapeHtml(subtitle)}</p>` : ''}
      <div class="legal-page">
        ${body || '<p>No content yet.</p>'}
      </div>
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
      const rb = resolveEntry(firstResult.sys.id, includes);
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
    const resultsHtml = buildResultsFromResultBlocks(resultsBlocks, includes);

    let strategyHtml = '';
    if (strategy) {
      if (typeof strategy === 'object' && strategy.content) {
        strategyHtml = richTextToHtml(strategy, includes);
      } else {
        strategyHtml = escapeHtml(String(strategy));
      }
    }

    const seoEntry = resolveSeoRef(it, includes);
    const seo = getSeo(seoEntry);
    const seoTitle = seo.pageTitle || clientName;
    const seoDescription = seo.pageDescription || (challenge ? challenge.replace(/<[^>]+>/g, '').slice(0, 160) + '…' : '');
    const canonical = seo.canonicalUrl || `${BASE}/resources/case-studies/${encodeURIComponent(slug)}/`;

    const studyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(seoTitle + ' | TheSEOPilot', seoDescription, canonical)}
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
      fetchContentful(`/entries?content_type=${BLOG_CT}&order=-fields.publishedDate&include=2`),
      fetchContentful(`/entries?content_type=${CASE_STUDY_CT}&order=-sys.updatedAt&include=2`).catch(() => ({ items: [], includes: {} })),
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
