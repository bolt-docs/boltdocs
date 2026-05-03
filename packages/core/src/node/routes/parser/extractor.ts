
import GithubSlugger from 'github-slugger';
import { sanitizeHtml, stripHtmlTags } from '../../utils';

const HEADINGS_REGEX = /^(#{2,4})\s+(.+)$/gm;
const MD_LINK_REGEX = /\[([^\]]+)\]\([^\)]+\)/g;
const MD_FORMAT_REGEX = /[_*`]/g;
const MD_HEADER_LINE_REGEX = /^#+.*$/gm;
const JS_EXPR_REGEX = /\{[^\}]+\}/g;
const WHITESPACE_REGEX = /\s+/g;

export interface ContentData {
  headings: { level: number; text: string; id: string }[];
  description: string;
  plainText: string;
}

export function extractContentData(content: string, explicitDescription?: string): ContentData {
  const slugger = new GithubSlugger();
  const headings: { level: number; text: string; id: string }[] = [];
  
  // 1. Extract Headings (Single pass for headings)
  for (const match of content.matchAll(HEADINGS_REGEX)) {
    const level = match[1].length;
    const rawText = match[2]
      .replace(MD_LINK_REGEX, '$1')
      .replace(MD_FORMAT_REGEX, '')
      .trim();

    const sanitizedText = sanitizeHtml(rawText).trim();
    const id = slugger.slug(sanitizedText);
    headings.push({ level, text: sanitizedText, id });
  }

  // 2. Generate Plain Text (Optimized for search - combined regex)
  // This replaces multiple steps with a more aggressive single pass for core cleaning
  const finalPlainText = stripHtmlTags(
    content
      .replace(MD_HEADER_LINE_REGEX, '')
      .replace(JS_EXPR_REGEX, '')
      .replace(/[\[\]_*`]/g, '') // Combined character set for formatting
      .replace(/\((?:[^)]+)\)/g, '') // Strip link URLs but keep text (simplified)
      .replace(WHITESPACE_REGEX, ' ')
  ).trim();

  // 3. Resolve Description/Excerpt
  let description = explicitDescription ? sanitizeHtml(explicitDescription).trim() : '';
  
  if (!description && content) {
    description = finalPlainText.substring(0, 160);
  }

  return {
    headings,
    description,
    plainText: finalPlainText
  };
}
