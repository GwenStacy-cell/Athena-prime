import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..');

// In-memory cache of codebase files: Map<relativePath, { content: string, lines: string[], mtimeMs: number, meta?: object }>
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
  'please', 'tell', 'me', 'bot', 'athena', 'use', 'using', 'used', 'cmd', 'command', 'commands',
  'work', 'works', 'working', 'help', 'explain', 'show', 'make', 'give', 'get', 'want', 'need', 'i'
]);

/**
 * Dynamically extracts metadata from any source file without hardcoded dictionaries
 * @param {string} relPath - Relative path from src/
 * @param {string} content - Full source text
 * @param {string[]} lines - Split text lines
 */
export function extractFileMetadata(relPath = '', content = '', lines = []) {
  const norm = relPath.replace(/^src\//, '').replace(/\\/g, '/');
  const fileLines = lines.length > 0 ? lines : content.split('\n');
  const baseName = path.basename(norm, '.js');

  // 1. Commands module analysis
  if (norm.startsWith('commands/')) {
    const commands = [];
    const len = fileLines.length;

    for (let i = 0; i < len; i++) {
      const line = fileLines[i];
      const nameMatch = line.match(/^\s*name:\s*['"]([a-zA-Z0-9_-]+)['"]/);
      if (nameMatch) {
        const cmdName = nameMatch[1];
        let description = '';
        let category = '';
        let aliases = [];
        let isTopLevel = false;

        for (let j = i + 1; j < Math.min(len, i + 18); j++) {
          const l = fileLines[j];
          if (!description) {
            const descMatch = l.match(/description:\s*['"]([^'"]+)['"]/);
            if (descMatch) description = descMatch[1];
          }
          if (!category) {
            const catMatch = l.match(/category:\s*['"]([^'"]+)['"]/);
            if (catMatch) category = catMatch[1];
          }
          if (aliases.length === 0) {
            const aliasMatch = l.match(/aliases:\s*\[([^\]]*)\]/);
            if (aliasMatch) {
              aliases = aliasMatch[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean);
            }
          }
          if (l.includes('executePrefix') || l.includes('executeSlash') || l.includes('category:')) {
            isTopLevel = true;
          }
        }

        if (isTopLevel && !commands.some(c => c.name === cmdName)) {
          const choices = [];
          for (let k = i; k < Math.min(len, i + 45); k++) {
            const chMatch = fileLines[k].match(/value:\s*['"]([a-zA-Z0-9_-]+)['"]/);
            if (chMatch && !choices.includes(chMatch[1])) {
              choices.push(chMatch[1]);
            }
          }

          commands.push({
            name: cmdName,
            description,
            category: category || baseName,
            aliases,
            choices,
            lineNum: i + 1
          });
        }
      }
    }

    let summary = '';
    if (commands.length > 0) {
      const namesList = commands.map(c => {
        if (c.choices.length > 0) {
          return `!${c.name} [${c.choices.slice(0, 3).join('|')}${c.choices.length > 3 ? '...' : ''}]`;
        }
        return `!${c.name}`;
      }).slice(0, 4).join(', ');
      summary = `${(commands[0].category || baseName).toUpperCase()} Commands (${namesList}${commands.length > 4 ? ` +${commands.length - 4} more` : ''})`;
    } else {
      summary = `${baseName.toUpperCase()} Command Module`;
    }

    return { type: 'command', commands, summary };
  }

  // 2. Utils module analysis
  if (norm.startsWith('utils/')) {
    const exports = [];
    for (let i = 0; i < fileLines.length; i++) {
      const fnMatch = fileLines[i].match(/export\s+(?:async\s+)?(?:function|class|const)\s+([a-zA-Z0-9_]+)/);
      if (fnMatch && !exports.includes(fnMatch[1])) {
        exports.push(fnMatch[1]);
      }
    }

    let topDesc = '';
    const jsDocMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
    if (jsDocMatch) {
      const docLines = jsDocMatch[0].split('\n').map(l => l.replace(/^\s*\/?\*+\/?\s*/, '').trim()).filter(Boolean);
      if (docLines.length > 0) topDesc = docLines[0];
    }

    const summary = topDesc ? `${topDesc} (${baseName})` : `Utility Engine: ${exports.slice(0, 3).join(', ')} (${baseName})`;
    return { type: 'util', exports, summary };
  }

  // 3. Database module analysis
  if (norm === 'database.js') {
    return {
      type: 'database',
      summary: 'SQLite Database Schema & State Persistence Store'
    };
  }

  return { type: 'core', summary: `Core Bot Engine Module (${baseName})` };
}

/**
 * Returns a dynamically computed role summary for any source file
 * @param {string} relPath - File path
 * @param {object} [fileData] - Pre-loaded file data
 */
export function describeFileRole(relPath = '', fileData = null) {
  if (fileData && fileData.meta && fileData.meta.summary) {
    return fileData.meta.summary;
  }
  if (codebaseCache) {
    const cached = codebaseCache.get(relPath.replace(/^src\//, '').replace(/\\/g, '/'));
    if (cached && cached.meta && cached.meta.summary) {
      return cached.meta.summary;
    }
  }
  return extractFileMetadata(relPath, fileData?.content || '', fileData?.lines || []).summary;
}

/**
 * Loads all JS source files from src/ into memory cache and indexes metadata
 */
export async function loadCodebaseCache(force = false) {
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
          const lines = content.split('\n');
          const meta = extractFileMetadata(relPath, content, lines);

          cache.set(relPath, {
            content,
            lines,
            mtimeMs: stats.mtimeMs,
            name: entry.name,
            meta
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
 * Extracts substantive search tokens and phrases from a user query
 */
export function extractSearchTokens(query = '') {
  const clean = query.toLowerCase().replace(/[?!.,;:()\[\]{}"'\\\/]/g, ' ').trim();
  const rawTokens = clean.split(/\s+/).filter(Boolean);
  const keywords = rawTokens.filter(t => t.length > 2 && !COMMON_STOPWORDS.has(t));

  const phrases = [];
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= rawTokens.length - len; i++) {
      const first = rawTokens[i];
      const last = rawTokens[i + len - 1];
      if (!COMMON_STOPWORDS.has(first) && !COMMON_STOPWORDS.has(last)) {
        const slice = rawTokens.slice(i, i + len);
        if (slice.some(word => keywords.includes(word))) {
          const phrase = slice.join(' ');
          if (phrase.length > 4 && !phrases.includes(phrase)) phrases.push(phrase);
        }
      }
    }
  }

  return { phrases, keywords, rawTokens };
}

/**
 * Searches the real codebase dynamically for code snippets relevant to the query
 * @param {string} query - The user query
 * @param {object} options - Search configuration
 * @returns {Promise<Array<{ file: string, startLine: number, endLine: number, code: string, score: number, reason: string, role: string }>>}
 */
export async function searchCodebase(query = '', { maxSnippets = 5, snippetLines = 45 } = {}) {
  const cache = await loadCodebaseCache();
  const { phrases, keywords, rawTokens } = extractSearchTokens(query);

  if (phrases.length === 0 && keywords.length === 0) {
    return [];
  }

  const matches = [];

  for (const [relPath, fileData] of cache.entries()) {
    // Avoid self-matching internal meta search engine files
    if (relPath.includes('botGuideKnowledge') || relPath.includes('codebaseKnowledge')) continue;

    const isCommand = relPath.startsWith('commands/');
    const isUtil = relPath.startsWith('utils/');
    const isDatabase = relPath === 'database.js';

    let fileMultiplier = 1.0;
    if (isCommand) fileMultiplier = 2.0;
    else if (isUtil) fileMultiplier = (relPath.includes('antinuke') || relPath.includes('antiStrip')) ? 2.5 : 1.6;
    else if (isDatabase) fileMultiplier = 1.4;

    // Check if filename matches a keyword (e.g. learn.js matches learn, antinuke.js matches nuke)
    const baseName = path.basename(relPath, '.js').toLowerCase();
    const fileNameMatch = keywords.some(k => baseName === k || (k.length > 3 && baseName.includes(k)) || (baseName.length > 3 && k.includes(baseName)));
    if (fileNameMatch) {
      fileMultiplier *= 2.2;
    }

    // De-prioritize internal/hidden or owner-only commands (e.g., enuke.js) unless explicitly queried by name
    const isHiddenOrOwner = fileData.content.includes('slashHidden: true') || fileData.content.includes('hidden: true') || fileData.content.includes("category: 'owner'") || fileData.content.includes('category: "owner"');
    if (isHiddenOrOwner) {
      const explicitMention = rawTokens.includes(baseName) || keywords.includes(baseName);
      if (!explicitMention) {
        fileMultiplier *= 0.05;
      }
    }

    const lowerContent = fileData.content.toLowerCase();

    // 1. Exact phrase matches (e.g. "god of war", "security enable all", "panic lockdown")
    for (const phrase of phrases) {
      if (lowerContent.includes(phrase)) {
        let matchIdx = -1;
        while ((matchIdx = lowerContent.indexOf(phrase, matchIdx + 1)) !== -1) {
          const preText = fileData.content.slice(0, matchIdx);
          const lineNum = preText.split('\n').length;
          matches.push({
            file: relPath,
            lineNum,
            score: (130 + phrase.length * 3) * fileMultiplier,
            reason: `Exact phrase "${phrase}"`
          });
          if (matches.length > 60) break;
        }
      }
    }

    // 2. Line by line keyword, definition, function export, and choice matches
    for (let i = 0; i < fileData.lines.length; i++) {
      const line = fileData.lines[i].toLowerCase();
      let lineScore = 0;

      for (const kw of keywords) {
        // High priority: Command definition name match (e.g. name: 'learn' or name: 'ranktheme')
        if (line.includes(`name: '${kw}'`) || line.includes(`name: "${kw}"`)) {
          lineScore += 260;
        }
        // Exported utility engine function match (e.g. export async function rawBan, executeIntelligentChannelRepair)
        if ((line.includes('export async function') || line.includes('export function')) && line.includes(kw)) {
          lineScore += 250;
        }
        // Aliases match
        if (line.includes(`'${kw}'`) && line.includes('aliases:')) {
          lineScore += 160;
        }
        // Choices/options match
        if (line.includes(`value: '${kw}'`) || line.includes(`value: "${kw}"`)) {
          lineScore += 140;
        }
        // General keyword presence
        if (line.includes(kw)) {
          lineScore += (kw.length > 4 ? 10 : 5);
        }
      }

      if (lineScore > 0) {
        matches.push({
          file: relPath,
          lineNum: i + 1,
          score: lineScore * fileMultiplier,
          reason: `Matched keyword & syntax definitions`
        });
      }
    }
  }

  if (matches.length === 0) return [];

  matches.sort((a, b) => b.score - a.score);

  // Group nearby line matches in the same file into cohesive blocks
  const selectedBlocks = [];
  const coveredRanges = new Map(); // relPath -> Array<[start, end]>

  for (const match of matches) {
    if (selectedBlocks.length >= maxSnippets) break;

    const fileData = cache.get(match.file);
    if (!fileData) continue;

    let startLine = Math.max(1, match.lineNum - 10);
    // If it's a command file, expand backwards to the command declaration if nearby
    if (match.file.startsWith('commands/')) {
      for (let j = match.lineNum - 1; j >= Math.max(0, match.lineNum - 28); j--) {
        const l = fileData.lines[j];
        if (l && (l.includes("name: '") || l.includes('name: "'))) {
          startLine = Math.max(1, j + 1);
          break;
        }
      }
    }

    let endLine = Math.min(fileData.lines.length, startLine + snippetLines - 1);
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
    const role = describeFileRole(match.file, fileData);

    selectedBlocks.push({
      file: `src/${match.file}`,
      startLine,
      endLine,
      code: snippet,
      score: match.score,
      reason: match.reason,
      role
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
  out.push('The following code snippets were dynamically extracted directly from the bot codebase for this query.');
  out.push('Conduct an exhaustive deep-dive into this source code. Use it as authoritative ground truth for command names, syntax, arguments, execution logic, and options.');
  out.push('CRITICAL REQUIREMENT: In your final answer, you MUST include a dedicated section citing the exact source code files and line ranges where you deep-dived and analyzed the answer from.\n');

  for (const snip of snippets) {
    out.push(`--- File: ${snip.file} (Lines ${snip.startLine}-${snip.endLine}) [Module: ${snip.role} | Match: ${snip.reason}] ---`);
    out.push('```javascript');
    out.push(snip.code);
    out.push('```\n');
  }

  return out.join('\n');
}
