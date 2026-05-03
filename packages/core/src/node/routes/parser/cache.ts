
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ParsedDocFile } from '../types';
import { getCacheConfig } from '../../utils';

const memoryCache = new Map<string, { data: ParsedDocFile; mtime: number }>();

const getParserCacheDir = () => {
  const config = getCacheConfig();
  return path.resolve(process.cwd(), config.dir, 'cache/parser');
};

/**
 * Fast sharded cache for parser results.
 * Respects BOLTDOCS_CACHE_DIR and BOLTDOCS_NO_CACHE via getCacheConfig.
 */
export class ParserCache {
  static get(file: string): ParsedDocFile | null {
    const config = getCacheConfig();
    if (config.noCache) return null;

    try {
      // 1. Memory Tier (Ultra-fast)
      const memEntry = memoryCache.get(file);
      const stats = fs.statSync(file);
      
      if (memEntry && memEntry.mtime === stats.mtimeMs) {
        return memEntry.data;
      }

      // 2. Disk Tier
      const cacheDir = getParserCacheDir();
      const id = crypto.createHash('md5').update(file).digest('hex');
      const shardPath = path.join(cacheDir, `${id}.json`);
      
      if (!fs.existsSync(shardPath)) {
        return null;
      }
      
      const cached = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
      
      // Validation
      if (cached._mtime !== stats.mtimeMs) return null;
      
      // Update memory tier
      memoryCache.set(file, { data: cached.data, mtime: cached._mtime });
      
      return cached.data;
    } catch {
      return null;
    }
  }

  static set(file: string, data: ParsedDocFile): void {
    const config = getCacheConfig();
    if (config.noCache) return;

    try {
      const stats = fs.statSync(file);
      
      // Update memory tier immediately
      memoryCache.set(file, { data, mtime: stats.mtimeMs });

      const cacheDir = getParserCacheDir();
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const id = crypto.createHash('md5').update(file).digest('hex');
      const shardPath = path.join(cacheDir, `${id}.json`);
      
      const payload = {
        _mtime: stats.mtimeMs,
        data
      };
      
      fs.writeFileSync(shardPath, JSON.stringify(payload));
    } catch {
      // Fallback: Skip caching if file cannot be stat'd
    }
  }

  static clear(): void {
    memoryCache.clear();
    const cacheDir = getParserCacheDir();
    if (fs.existsSync(cacheDir)) {
      try {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      } catch {
        // Ignore removal errors
      }
    }
  }
}
