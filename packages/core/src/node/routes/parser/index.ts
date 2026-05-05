
import path from 'node:path';
import { 
  parseFrontmatterAsync, 
  capitalize, 
  stripNumberPrefix, 
  extractNumberPrefix,
  logSecurityEvent 
} from '../../utils';
import { MAX_PATH_LENGTH, ALLOWED_PATH_CHARS } from '../../security/constants';
import { EncodingSecurityError, PathTraversalError } from '../../errors';
import type { BoltdocsConfig } from '../../config';
import type { ParsedDocFile } from '../types';

import { resolveRoutePath } from './resolver';
import { extractContentData } from './extractor';
import { processSeoData, sanitizeFrontmatterStrings } from './metadata';

import { ParserCache } from './cache';

export async function parseDocFile(
  file: string,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
): Promise<ParsedDocFile> {
  // 0. Cache Check (Ultra-Fast Path)
  // Check memory/disk cache BEFORE any heavy security validation or path resolution
  const cached = await ParserCache.get(file);
  if (cached) return cached;

  // 1. Security Validation (Now deferred after cache miss)
  const decodedFile = validateFilePath(file);
  const absoluteFile = path.resolve(decodedFile);
  const absoluteDocsDir = path.resolve(docsDir);
  
  const relativePathForSecurity = path.relative(absoluteDocsDir, absoluteFile).replace(/\\/g, '/');
  if (relativePathForSecurity.startsWith('../') || (relativePathForSecurity !== '.' && !ALLOWED_PATH_CHARS.test(relativePathForSecurity))) {
     throw new PathTraversalError(`Security breach: File is outside of docs directory, contains null bytes, or invalid path characters: ${path.basename(decodedFile)}`);
  }

  // 2. Parse Frontmatter & Content (Async)
  const { data, content } = await parseFrontmatterAsync(file);
  
  // 3. Resolve Path & Hierarchy
  const resolution = resolveRoutePath(
    absoluteFile, 
    absoluteDocsDir, 
    basePath, 
    config, 
    data.permalink
  );

  // 4. Extract Content Data (Headings, SEO, PlainText)
  const contentData = extractContentData(content, data.description);

  // 5. Process Metadata
  const sanitizedStrings = sanitizeFrontmatterStrings(data);
  const seo = processSeoData(data);

  // 6. Determine Sidebar & Group Metadata
  const rawFileName = path.basename(resolution.relativePath);
  const cleanFileName = stripNumberPrefix(rawFileName);
  
  // We use remainingParts for grouping to ignore version/locale/tab segments
  const dirParts = resolution.remainingParts.slice(0, -1);
  const cleanDirName = dirParts.length > 0 
    ? stripNumberPrefix(dirParts[0]) 
    : undefined;

  const isGroupIndex = resolution.remainingParts.length === 2 && /^index\.mdx?$/.test(cleanFileName);
  const sidebarPosition = data.sidebarPosition ?? extractNumberPrefix(rawFileName);

  const parsed: ParsedDocFile = {
    route: {
      path: resolution.finalPath,
      componentPath: file,
      filePath: resolution.relativePath,
      title: sanitizedStrings.title || stripNumberPrefix(path.basename(file, path.extname(file))),
      description: contentData.description,
      sidebarPosition,
      headings: contentData.headings,
      locale: resolution.locale,
      version: resolution.version,
      badge: sanitizedStrings.badge,
      icon: data.icon ? String(data.icon) : undefined,
      tab: resolution.inferredTab,
      subRouteGroup: resolution.subRouteGroup,
      _content: contentData.plainText,
      _rawContent: content,
      date: data.date,
      lastUpdated: data.lastUpdated,
      category: data.category,
      order: data.order,
      sidebarLabel: data.sidebarLabel,
      sidebarHidden: data.sidebarHidden || data.hidden,
      seo,
    },
    relativeDir: cleanDirName,
    isGroupIndex,
    inferredTab: resolution.inferredTab,
    groupMeta: isGroupIndex ? {
      title: data.groupTitle || sanitizedStrings.title || (cleanDirName ? capitalize(cleanDirName) : ''),
      position: data.groupPosition ?? data.sidebarPosition ?? (cleanDirName ? extractNumberPrefix(dirParts[0]) : undefined),
      icon: data.icon ? String(data.icon) : undefined,
    } : undefined,
    inferredGroupPosition: cleanDirName ? extractNumberPrefix(dirParts[0]) : undefined,
  };

  // 7. Save to Cache for next time (Async)
  await ParserCache.set(file, parsed);

  return parsed;
}

function validateFilePath(file: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(file);
  } catch (e) {
    logSecurityEvent('SECURITY_ERROR', 'Invalid encoding in path', { file });
    throw new EncodingSecurityError(`Security breach: Invalid characters or encoding in path`);
  }

  if (decoded.length > MAX_PATH_LENGTH) {
    throw new PathTraversalError(`Path length exceeds limit`);
  }
  
  return decoded;
}
