
import GithubSlugger from 'github-slugger';
import { sanitizeHtml, stripHtmlTags } from '../../utils';

const HEADINGS_REGEX = /^(#{2,4})\s+(.+)$/gm;
const MD_LINK_REGEX = /\[([^\]]+)\]\([^\)]+\)/g;
const MD_FORMAT_REGEX = /[_*`]/g;
const WHITESPACE_REGEX = /\s+/g;

export interface ContentData {
  headings: { level: number; text: string; id: string }[];
  description: string;
  plainText: string;
}

const slugger = new GithubSlugger();

// Pre-compiled regex for cleaning plain text
const CLEAN_MARKDOWN_REGEX = /[\[\]_*`]|#+.*$|\{[^\}]+\}/gm;
const CLEAN_LINKS_REGEX = /\((?:[^)]+)\)/g;

export function extractContentData(content: string, explicitDescription?: string): ContentData {
  slugger.reset();
  const headings: { level: number; text: string; id: string }[] = [];

  // 1. Extract Headings (Single pass for headings)
  for (const match of content.matchAll(HEADINGS_REGEX)) {
    const level = match[1].length;
    // Combine link and format removal
    const rawText = match[2]
      .replace(MD_LINK_REGEX, '$1')
      .replace(MD_FORMAT_REGEX, '')
      .trim();

    const sanitizedText = sanitizeHtml(rawText).trim();
    const id = slugger.slug(sanitizedText);
    headings.push({ level, text: sanitizedText, id });
  }

  // 2. Generate Plain Text (Optimized for search - combined regex)
  const finalPlainText = stripHtmlTags(
    content
      .replace(CLEAN_MARKDOWN_REGEX, '')
      .replace(CLEAN_LINKS_REGEX, '')
      .replace(WHITESPACE_REGEX, ' ')
  ).trim();

  // 3. Resolve Description/Excerpt
  let description = explicitDescription ? sanitizeHtml(explicitDescription).trim() : '';

  if (!description && content) {
    // Take a slightly larger slice then trim to avoid cutting words in half if possible
    // but keep it simple for now as per original logic
    description = finalPlainText.substring(0, 160);
  }

  return {
    headings,
    description,
    plainText: finalPlainText
  };
}
