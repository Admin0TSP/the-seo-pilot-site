/**
 * Markdown → Contentful Rich Text helper.
 * Wraps @contentful/rich-text-from-markdown with safe-defaults.
 */

const { richTextFromMarkdown } = require('@contentful/rich-text-from-markdown');

const EMPTY_DOC = {
  nodeType: 'document',
  data: {},
  content: [
    { nodeType: 'paragraph', data: {}, content: [{ nodeType: 'text', value: '', marks: [], data: {} }] },
  ],
};

/**
 * Convert a markdown string to a Contentful Rich Text document.
 * Returns the EMPTY_DOC node if the input is empty/whitespace.
 */
async function toRichText(md) {
  if (md == null) return EMPTY_DOC;
  const trimmed = String(md).trim();
  if (!trimmed) return EMPTY_DOC;
  try {
    const doc = await richTextFromMarkdown(trimmed);
    if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) return EMPTY_DOC;
    return doc;
  } catch (e) {
    throw new Error(`Markdown→RichText conversion failed: ${e.message}`);
  }
}

module.exports = { toRichText, EMPTY_DOC };
