#!/usr/bin/env node
/**
 * Generate Resources pages from Contentful.
 * - Blog listing + /resources/blog/{slug}/index.html
 * - Case studies listing + /resources/case-studies/{slug}/index.html (Contentful-only; Aspora is static)
 *
 * Requires: CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN in .env
 * Run: npm run generate
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://theseopilot.pro';

function env(name) {
  return process.env[name] || '';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

async function generateBlog(data) {
  const listing = data.items || [];
  const listHtml = listing
    .map((it) => {
      const f = it.fields || {};
      const slug = f.slug || it.sys?.id || 'post';
      const title = f.title || 'Untitled';
      const excerpt = f.excerpt || '';
      const href = `/resources/blog/${encodeURIComponent(slug)}/`;
      return `
      <article>
        <h2><a href="${href}">${escapeHtml(title)}</a></h2>
        <p>${escapeHtml(excerpt)}</p>
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
      ${listHtml || '<p style="text-align:center;color:var(--muted);">No posts yet. Add blog posts in Contentful (content_type=blogPost).</p>'}
    </div>
  </main>
${footer()}
</body>
</html>`;

  writeFile(path.join(ROOT, 'resources', 'blog', 'index.html'), blogIndex);

  for (const it of listing) {
    const f = it.fields || {};
    const slug = f.slug || it.sys?.id || 'post';
    const title = f.title || 'Untitled';
    const excerpt = f.excerpt || '';
    const body = f.body || f.content || '';
    const seoTitle = f.seoTitle || title;
    const seoDescription = f.seoDescription || excerpt;
    const canonical = `${BASE}/resources/blog/${encodeURIComponent(slug)}/`;

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
      <h1 style="margin-bottom:1rem;">${escapeHtml(title)}</h1>
      <div class="legal-page">
        ${body}
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
    const slug = f.slug || it.sys?.id;
    if (!slug) continue;
    const title = f.title || 'Case Study';
    const client = f.clientName || f.client || '';
    const metric = f.killerMetric || '';
    const href = `/resources/case-studies/${encodeURIComponent(slug)}/`;
    cards.push(`      <div class="case-study-card">
        <a href="${href}">
          <h2>${escapeHtml(title)}</h2>
          <p class="case-study-meta">${escapeHtml(client)}</p>
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
    const slug = f.slug || it.sys?.id;
    if (!slug) continue;
    const title = f.title || 'Case Study';
    const challenge = f.challenge || '';
    const strategy = f.strategy || '';
    const results = f.results || '';
    const whyAI = f.whyAICites || '';
    const graph1Url = f.graphImage1Url || '';
    const graph2Url = f.graphImage2Url || '';
    const canonical = `${BASE}/resources/case-studies/${encodeURIComponent(slug)}/`;
    const graphHtml = [graph1Url, graph2Url]
      .filter(Boolean)
      .map((u) => `<img src="${escapeHtml(u)}" alt="Results" class="results-graph" loading="lazy" />`)
      .join('\n        ');
    const desc = (typeof results === 'string' ? results.replace(/<[^>]+>/g, '') : '').slice(0, 160) + '…';

    const studyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${gtmHead()}
${baseHead(title + ' | TheSEOPilot', desc, canonical)}
</head>
<body>
${gtmBody()}
${header()}
  <main class="case-study-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/resources/">Resources</a> / <a href="/resources/case-studies/">Case Studies</a> / ${escapeHtml(title)}
    </nav>
    <div class="container" style="padding-top:1rem;">
      <h1 style="margin-bottom:1rem;">${escapeHtml(title)}</h1>
      <section><h2>The Challenge</h2><p>${escapeHtml(challenge)}</p></section>
      <section><h2>The Strategy</h2><p>${escapeHtml(strategy)}</p></section>
      <section><h2>The Results</h2><div class="legal-page">${results || ''}</div>${graphHtml ? '\n        ' + graphHtml : ''}</section>
      <section><h2>Why AI Started Citing Them</h2><p>${escapeHtml(whyAI)}</p></section>
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
      fetchContentful('/entries?content_type=blogPost&order=-fields.publishDate'),
      fetchContentful('/entries?content_type=caseStudy&order=-fields.publishDate').catch(() => ({ items: [] })),
    ]);
    await generateBlog(blogRes);
    await generateCaseStudies(csRes);
    console.log('Generated Resources from Contentful.');
  } catch (e) {
    console.error('Generate failed:', e.message);
    process.exit(1);
  }
}

main();
