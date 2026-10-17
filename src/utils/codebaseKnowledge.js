import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..');

// In-memory cache of codebase files: Map<relativePath, { content: string, lines: string[], mtimeMs: number }>
let codebaseCache = null;
let lastCacheBuild = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL for development refreshes

const IGNORED_DIRS = new Set(['assets', 'fonts', 'node_modules', '.git']);
const COMMON_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'and', 'or', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'right', 'available', 'available?',
  'please', 'tell', 'me', 'bot', 'athena'
]);

/**
 * Loads all JS source files from src/ into memory cache
 */
async function loadCodebaseCache(force = false) {
  const now = Date.now();
  if (codebaseCache && !force && (now - lastCacheBuild < CACHE_TTL_MS)) {
    return codebaseCache;
  }

  const cache = new Map();

  async function walkDir(dir) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const stats = await fs.promises.stat(fullPath);
          const content = await fs.promises.readFile(fullPath, 'utf8');
          const relPath = path.relative(SRC_DIR, fullPath).replace(/\\/g, '/');
          cache.set(relPath, {
            content,
            lines: content.split('\n'),
            mtimeMs: stats.mtimeMs,
            name: entry.name
          });
        } catch {}
      }
    }
  }

  await walkDir(SRC_DIR);
  codebaseCache = cache;
  lastCacheBuild = now;
  return codebaseCache;
}

/**
 * Extracts phrases and keywords from a user query
 */
export function extractSearchTokens(query = '') {
  const clean = query.toLowerCase().replace(/[?!.,;:()\[\]{}"'\\\/]/g, ' ').trim();
  const rawTokens = clean.split(/\s+/).filter(Boolean);

  // Exact 2-4 word phrases to search for
  const phrases = [];
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= rawTokens.length - len; i++) {
      const phrase = rawTokens.slice(i, i + len).join(' ');
      if (phrase.length > 5) phrases.push(phrase);
    }
  }

  // Keywords excluding stopwords
  const keywords = rawTokens.filter(t => t.length > 2 && !COMMON_STOPWORDS.has(t));

  return { phrases, keywords, rawTokens };
}

/**
 * Searches the real codebase for code snippets relevant to the query
 * @param {string} query - The user query
 * @param {object} options - Search configuration
 * @returns {Promise<Array<{ file: string, startLine: number, endLine: number, code: string, score: number, reason: string }>>}
 */
export async function searchCodebase(query = '', { maxSnippets = 4, snippetLines = 35 } = {}) {
  const cache = await loadCodebaseCache();
  const { phrases, keywords, rawTokens } = extractSearchTokens(query);

  if (phrases.length === 0 && keywords.length === 0) {
    return [];
  }

  const matches = [];

  for (const [relPath, fileData] of cache.entries()) {
    const isCommand = relPath.startsWith('commands/');
    const isUtil = relPath.startsWith('utils/');
    const isEvent = relPath.startsWith('events/');
    const isDatabase = relPath === 'database.js';

    // Base multiplier: commands and utils have the highest value for user-facing instructions
    let fileMultiplier = 1.0;
    if (isCommand) fileMultiplier = 2.0;
    else if (isUtil) fileMultiplier = 1.6;
    else if (isDatabase) fileMultiplier = 1.3;
    else if (isEvent) fileMultiplier = 1.2;

    const lowerContent = fileData.content.toLowerCase();

    // 1. Check exact phrase matches (e.g. "god of war", "security enable all", "rank theme")
    for (const phrase of phrases) {
      if (lowerContent.includes(phrase)) {
        let matchIdx = -1;
        while ((matchIdx = lowerContent.indexOf(phrase, matchIdx + 1)) !== -1) {
          // Calculate line number
          const preText = fileData.content.slice(0, matchIdx);
          const lineNum = preText.split('\n').length;
          matches.push({
            file: relPath,
            lineNum,
            score: (50 + phrase.length * 2) * fileMultiplier,
            reason: `Exact phrase "${phrase}"`
          });
          if (matches.length > 50) break;
        }
      }
    }

    // 2. Check keyword density in sliding line windows
    for (let i = 0; i < fileData.lines.length; i++) {
      const line = fileData.lines[i].toLowerCase();
      let lineScore = 0;
      let matchedWordCount = 0;

      for (const kw of keywords) {
        if (line.includes(kw)) {
          lineScore += (kw.length > 4 ? 8 : 4);
          matchedWordCount++;
        }
      }

      // Check for command definition headers (e.g. name: 'ranktheme')
      if (line.includes('name:') && keywords.some(k => line.includes(k))) {
        lineScore += 25;
      }

      if (lineScore > 0) {
        matches.push({
          file: relPath,
          lineNum: i + 1,
          score: (lineScore + (matchedWordCount > 1 ? matchedWordCount * 10 : 0)) * fileMultiplier,
          reason: `Matched ${matchedWordCount} keywords`
        });
      }
    }
  }

  if (matches.length === 0) return [];

  // Group nearby line matches in the same file into cohesive blocks
  matches.sort((a, b) => b.score - a.score);

  const selectedBlocks = [];
  const coveredRanges = new Map(); // relPath -> Array<[start, end]>

  for (const match of matches) {
    if (selectedBlocks.length >= maxSnippets) break;

    const fileData = cache.get(match.file);
    if (!fileData) continue;

    const halfWindow = Math.floor(snippetLines / 2);
    let startLine = Math.max(1, match.lineNum - 8);
    let endLine = Math.min(fileData.lines.length, startLine + snippetLines - 1);

    // If near end, shift start back
    if (endLine - startLine < snippetLines - 1) {
      startLine = Math.max(1, endLine - snippetLines + 1);
    }

    // Check overlap with existing block in same file
    const existing = coveredRanges.get(match.file) || [];
    const overlaps = existing.some(([s, e]) => {
      return (startLine >= s && startLine <= e) || (endLine >= s && endLine <= e) || (startLine <= s && endLine >= e);
    });

    if (overlaps) continue;

    existing.push([startLine, endLine]);
    coveredRanges.set(match.file, existing);

    const snippet = fileData.lines.slice(startLine - 1, endLine).join('\n');

    selectedBlocks.push({
      file: `src/${match.file}`,
      startLine,
      endLine,
      code: snippet,
      score: match.score,
      reason: match.reason
    });
  }

  return selectedBlocks;
}

/**
 * Formats retrieved codebase snippets into clean markdown for AI ingestion
 */
export function formatCodebaseContext(snippets = []) {
  if (!snippets || snippets.length === 0) return '';

  const out = [];
  out.push('=== RELEVANT BOT SOURCE CODE FROM REPOSITORY (GROUND TRUTH) ===');
  out.push('The following code snippets were searched and extracted directly from the bot codebase for this query.');
  out.push('Use this source code as authoritative ground truth for command names, syntax, arguments, themes, and options:\n');

  for (const snip of snippets) {
    out.push(`--- File: ${snip.file} (Lines ${snip.startLine}-${snip.endLine}) [Match: ${snip.reason}] ---`);
    out.push('```javascript');
    out.push(snip.code);
    out.push('```\n');
  }

  return out.join('\n');
}
