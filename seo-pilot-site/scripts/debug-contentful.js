#!/usr/bin/env node
/**
 * Debug script: fetch one blog entry from Contentful and print field names + content field status.
 * Run: node scripts/debug-contentful.js [slug]
 * Requires: .env with CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN
 *
 * Use this to verify:
 * 1. What fields exist on your blog entries
 * 2. Whether the content field has data
 * 3. The exact API ID of your content field
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const slug = process.argv[2] || 'what-is-generative-engine-optimization';

const SPACE = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;
const BLOG_CT = process.env.CONTENTFUL_BLOG_CONTENT_TYPE || 'pageBlogPost';

if (!SPACE || !TOKEN) {
  console.error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN in .env');
  process.exit(1);
}

const url = `https://cdn.contentful.com/spaces/${SPACE}/environments/master/entries?content_type=${BLOG_CT}&fields.slug=${slug}&include=2&locale=*`;

fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  .then((r) => r.json())
  .then((data) => {
    const items = data.items || [];
    const entry = items[0];
    if (!entry) {
      console.log('No entry found for slug:', slug);
      console.log('Try: node scripts/debug-contentful.js your-post-slug');
      process.exit(1);
    }
    const f = entry.fields || {};
    const fieldNames = Object.keys(f);
    console.log('\n=== Contentful Debug: Blog Entry ===');
    console.log('Slug:', slug);
    console.log('Entry ID:', entry.sys?.id);
    console.log('Fields on entry:', fieldNames.join(', '));
    console.log('');
    for (const name of fieldNames) {
      const val = f[name];
      const localeVal = typeof val === 'object' && val !== null && !Array.isArray(val) ? Object.values(val)[0] : val;
      let preview = '';
      if (localeVal && typeof localeVal === 'object' && localeVal.content) {
        const len = Array.isArray(localeVal.content) ? localeVal.content.length : 0;
        preview = ` [Rich text: ${len} block(s)]`;
      } else if (typeof localeVal === 'string') {
        preview = ` "${localeVal.slice(0, 60)}..."`;
      } else if (localeVal && localeVal.sys) {
        preview = ` [Link: ${localeVal.sys.id}]`;
      }
      console.log(`  - ${name}:${preview}`);
    }
    console.log('\n--- Content field check ---');
    const contentCandidates = ['content', 'body', 'mainContent', 'main_content'];
    for (const fid of contentCandidates) {
      const val = f[fid];
      const unwrapped = val && typeof val === 'object' ? Object.values(val)[0] : val;
      const hasContent = unwrapped && typeof unwrapped === 'object' && Array.isArray(unwrapped.content) && unwrapped.content.length > 0;
      console.log(`  ${fid}: ${val ? (hasContent ? `OK (${unwrapped.content.length} blocks)` : 'exists but empty or invalid') : 'not found'}`);
    }
    console.log('\nIf "content" shows "not found", your field may have a different API ID.');
    console.log('Check Contentful → Content model → Page - Blog Post → your main content field → API identifier.');
    console.log('Set CONTENTFUL_CONTENT_FIELD=yourActualFieldId in .env if different.\n');
  })
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
