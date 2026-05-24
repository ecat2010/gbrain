/**
 * Chinese Tokenizer — CJK-aware word segmentation using jieba.
 *
 * v0.1.0 — Phase 1 of Chinese language support overhaul.
 *
 * Uses @node-rs/jieba with two dictionary layers:
 *   1. dict.txt.big from jieba_fast (traditional Chinese, 584K entries)
 *   2. canto-dict.txt (Cantonese-specific words, YUE dialect)
 *
 * Falls back to whitespace tokenization for non-CJK text.
 * See src/core/cjk.ts for density thresholds and character ranges.
 *
 * @module
 */

import { Jieba } from '@node-rs/jieba';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasCJK, CJK_DENSITY_THRESHOLD } from './cjk.ts';

// ─── Dictionaries ──────────────────────────────────────────────

/** Paths to dictionary files (resolved at module load time). */
function dictPaths(): { bigDict: string; cantoDict: string } {
  // Try multiple lookup strategies for different environments
  // (bun run, bun build, bun test, bundled binary)
  const candidates = [
    // Relative to this source file
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'extra_dict', 'dict.txt.big'),
    // From jieba_fast-master (if extracted alongside)
    join(dirname(fileURLToPath(import.meta.url)), 'canto-dict.txt'),
    // Fallback paths for bundled builds
    join(process.cwd(), 'extra_dict', 'dict.txt.big'),
    join(process.cwd(), 'src', 'core', 'canto-dict.txt'),
    'D:/jieba_fast-master/jieba_fast-master/extra_dict/dict.txt.big',
    'D:/gbrain-master/src/core/canto-dict.txt',
  ];

  // Find the big dict (dict.txt.big) — all candidates start with the actual file path
  // We need to find it relative to src/core/ or D: drive
  const bigDictCandidates = [
    'D:/jieba_fast-master/jieba_fast-master/extra_dict/dict.txt.big',
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'extra_dict', 'dict.txt.big'),
  ];
  const cantoDictCandidates = [
    join(dirname(fileURLToPath(import.meta.url)), 'canto-dict.txt'),
    'D:/gbrain-master/src/core/canto-dict.txt',
  ];

  const bigDict = bigDictCandidates.find(p => existsSync(p)) || '';
  const cantoDict = cantoDictCandidates.find(p => existsSync(p)) || '';

  if (!bigDict) {
    console.warn('[chinese-tokenizer] dict.txt.big not found. Using @node-rs/jieba default dict only.');
  }
  if (!cantoDict) {
    console.warn('[chinese-tokenizer] canto-dict.txt not found. Cantonese word list will not be loaded.');
  }

  return { bigDict, cantoDict };
}

// ─── Singleton ─────────────────────────────────────────────────

let _jieba: Jieba | null = null;

/**
 * Get or create the singleton Jieba instance.
 * Loads dict.txt.big (traditional Chinese) + canto-dict.txt (Cantonese).
 * Falls back to built-in dict if big dict is unavailable.
 */
function getJieba(): Jieba {
  if (_jieba) return _jieba;

  const { bigDict, cantoDict } = dictPaths();

  if (bigDict) {
    // Load with big dictionary
    const dictBuf = readFileSync(bigDict);
    _jieba = Jieba.withDict(dictBuf);
  } else {
    // Fall back to built-in dict from @node-rs/jieba
    const { dict } = require('@node-rs/jieba/dict');
    _jieba = Jieba.withDict(dict);
  }

  // Load Cantonese-specific dictionary
  if (cantoDict) {
    const cantoBuf = readFileSync(cantoDict);
    _jieba.loadDict(cantoBuf);
  }

  return _jieba;
}

// ─── Public API ────────────────────────────────────────────────

// ─── Mixed text pre-processing ──────────────────────────────────

/**
 * Split mixed CJK/non-CJK text into segments at ASCII word boundaries,
 * so email addresses, URLs, phone numbers, and other non-CJK tokens
 * don't confuse the Chinese tokenizer.
 *
 * Strategy: split on transitions between CJK and non-CJK characters,
 * keeping ASCII word clusters (emails, URLs, numbers) intact.
 */
function splitMixedSegments(text: string): string[] {
  const segments: string[] = [];
  // Split on transitions between CJK and non-CJK character types.
  // This keeps email addresses, URLs, phone numbers, and IDs intact.
  let current = '';
  let currentIsCJK = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/.test(ch);

    if (current.length === 0) {
      current = ch;
      currentIsCJK = isCJK;
    } else if (isCJK === currentIsCJK) {
      current += ch;
    } else {
      // Type transition
      if (current.trim().length > 0) segments.push(current.trim());
      current = ch;
      currentIsCJK = isCJK;
    }
  }
  if (current.trim().length > 0) segments.push(current.trim());

  return segments;
}

/**
 * Tokenize text into words.
 *
 * For CJK-dominant text (density >= CJK_DENSITY_THRESHOLD), uses jieba
 * precise mode with HMM. For Latin-dominant text, uses whitespace tokenization.
 * Mixed CJK/ASCII content is split at type boundaries first, then each
 * segment is tokenized with the appropriate strategy.
 *
 * @param text - Input text (Cantonese, Mandarin, English, or mixed)
 * @returns Array of word tokens
 *
 * @example
 *   tokenize("我哋今日去金渡镇政府打官司")
 *   // → ["我哋", "今日", "去", "金渡鎮", "政府", "打官司"]
 *
 *   tokenize("Hello world")
 *   // → ["Hello", "world"]
 *
 *   tokenize("我係梁志亮，ID係381855906@qq.com")
 *   // → ["我", "係", "梁志亮", "ID", "係", "381855906@qq.com"]
 */
export function tokenize(text: string): string[] {
  if (!text || text.length === 0) return [];

  // Check for any CJK at all
  if (!hasCJK(text)) {
    return text.match(/\S+/g) || [];
  }

  // Split into CJK and non-CJK segments for better mixed-content handling
  const segments = splitMixedSegments(text);
  const result: string[] = [];

  for (const segment of segments) {
    if (segment.length === 0) continue;

    if (hasCJK(segment)) {
      // CJK segment → jieba tokenize
      const jiebaTokens = getJieba().cut(segment, true);
      result.push(...jiebaTokens.filter(t => t.length > 0));
    } else if (/[A-Za-z0-9._@#\-/+]/.test(segment)) {
      // ASCII word cluster (email, URL, number, ID) → keep as-is
      result.push(segment.trim());
    } else {
      // Other non-CJK (punctuation runs, whitespace) → split by whitespace
      const parts = segment.match(/\S+/g);
      if (parts) result.push(...parts);
    }
  }

  return result;
}

/**
 * Tokenize text with search-engine mode (produces finer-grained tokens).
 *
 * In addition to precise mode tokens, sub-tokens of compound words are
 * also emitted. Useful for search indexing where higher recall is desired.
 *
 * @param text - Input text
 * @returns Array of word tokens (including sub-word components)
 *
 * @example
 *   tokenizeForSearch("金渡镇政府")
 *   // → ["金渡鎮", "政府", "金渡镇政府"]
 *
 *   tokenizeForSearch("劳动合同")
 *   // → ["劳动", "合同", "劳动合同"]
 */
export function tokenizeForSearch(text: string): string[] {
  if (!text || text.length === 0) return [];

  if (!hasCJK(text)) {
    return text.match(/\S+/g) || [];
  }

  const nonWhitespace = text.replace(/\s/g, '').length;
  if (nonWhitespace === 0) return [];
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
  const density = cjkCount / nonWhitespace;

  if (density < CJK_DENSITY_THRESHOLD) {
    return text.match(/\S+/g) || [];
  }

  return getJieba().cutForSearch(text, true);
}

/**
 * Tokenize text and join with spaces.
 * Useful as a preprocessing step before passing text to PGLite keyword search
 * or PostgreSQL tsvector (which expects space-separated tokens).
 *
 * @param text - Input text
 * @returns Space-joined token string
 *
 * @example
 *   tokenizeToSpaced("我哋今日去金渡镇政府")
 *   // → "我哋 今日 去 金渡鎮 政府"
 */
export function tokenizeToSpaced(text: string): string {
  return tokenize(text).join(' ');
}

/**
 * Count the number of tokens in text.
 * Unlike countCJKAwareWords (which just counts characters),
 * this performs actual word segmentation and returns the real word count.
 *
 * @param text - Input text
 * @returns Number of word tokens
 *
 * @example
 *   countTokens("我係梁志亮")    // → 3 (我 + 係 + 梁志亮)
 *   countTokens("Hello world")  // → 2
 */
export function countTokens(text: string): number {
  return tokenize(text).length;
}

/**
 * Extract top-K keywords from text using jieba TF-IDF.
 *
 * @param text - Input text
 * @param topK - Number of keywords to extract (default: 5)
 * @returns Array of { keyword, weight } objects sorted by weight descending
 *
 * @example
 *   extractKeywords("金渡镇政府违法解除劳动合同")
 *   // → [{ keyword: "金渡鎮", weight: ... }, { keyword: "劳动合同", weight: ... }, ...]
 */
export function extractKeywords(
  text: string,
  topK: number = 5,
): Array<{ keyword: string; weight: number }> {
  if (!text || text.length === 0) return [];

  const jieba = getJieba();

  // Use tag-based approach: filter for nouns, proper nouns, place names, org names
  const tagged = jieba.tag(text);
  const ngram: Record<string, { count: number; weight: number }> = {};
  const STOP_TAGS = new Set(['u', 'p', 'c', 'd', 'r', 'q', 'm', 'x', 'w', 'uj', 'uz', 'ug', 'ul', 'uv', 'ud', 'v']);

  for (const { word, tag } of tagged) {
    // Skip stop words, punctuation, and auxiliary tags
    if (STOP_TAGS.has(tag)) continue;
    if (word.length < 2) continue; // Skip single-character noise

    if (!ngram[word]) {
      ngram[word] = { count: 0, weight: 0 };
    }
    ngram[word].count++;

    // Weight by POS tag: proper nouns > nouns > verbs > adjectives
    if (tag === 'nr' || tag === 'ns' || tag === 'nt') {
      ngram[word].weight += 3.0;
    } else if (tag === 'n' || tag === 'nz' || tag === 'vn') {
      ngram[word].weight += 2.0;
    } else if (tag === 'v' || tag === 'vd') {
      ngram[word].weight += 1.5;
    } else if (tag === 'a' || tag === 'ad' || tag === 'an') {
      ngram[word].weight += 1.0;
    } else {
      ngram[word].weight += 0.5;
    }
  }

  // Sort by weight descending, then by count for tie-breakers
  return Object.entries(ngram)
    .map(([keyword, data]) => ({ keyword, weight: data.weight * Math.log(data.count + 1) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topK);
}

// ─── Utilities ─────────────────────────────────────────────────

/**
 * Filter out tokens that are pure punctuation or whitespace.
 * Useful when you need clean word sequences for search indexing.
 *
 * @param tokens - Array of word tokens
 * @returns Tokens with punctuation removed
 */
export function filterPunct(tokens: string[]): string[] {
  return tokens.filter(t => /[\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(t));
}

/**
 * Remove stop words from a token array.
 * Includes common Chinese and Cantonese function words.
 *
 * @param tokens - Array of word tokens
 * @returns Tokens with stop words removed
 */
export function removeStopWords(tokens: string[]): string[] {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '你', '他', '她', '它',
    '們', '我们', '你们', '他们', '她们', '它们',
    '這', '那', '這个', '那个', '這', '那',
    '和', '与', '及', '或', '但', '而', '且',
    '就', '也', '都', '要', '会', '可', '以',
    '不', '沒', '未', '别',
    '嗎', '呢', '啊', '哦', '嗯',
    '將', '把', '被', '讓', '给',
    '从', '到', '向', '對', '於',
    '上', '下', '中', '内', '外',
    '年', '月', '日', '時', '间',
    '好', '很', '太', '更', '最',
    '一', '二', '三', '四', '五',
    '六', '七', '八', '九', '十',
    '個', '种', '样', '些', '点',
  ]);
  return tokens.filter(t => !stopWords.has(t) && t.length > 0);
}
