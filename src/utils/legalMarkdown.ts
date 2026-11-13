/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InlineMarkdownNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineMarkdownNode[] }
  | { type: 'italic'; children: InlineMarkdownNode[] }
  | { type: 'code'; text: string };

export interface LegalMarkdownListItem {
  children: InlineMarkdownNode[];
  subItems?: LegalMarkdownListItem[];
}

export type LegalMarkdownBlock =
  | { type: 'heading'; level: number; children: InlineMarkdownNode[] }
  | { type: 'paragraph'; children: InlineMarkdownNode[] }
  | { type: 'list'; ordered: boolean; items: LegalMarkdownListItem[] }
  | { type: 'blockquote'; children: InlineMarkdownNode[] }
  | { type: 'hr' };

/**
 * Context-aware normalization of backslash-escaped Markdown syntax markers
 * at display time only (never mutating stored records).
 *
 * Unescapes ONLY Markdown formatting constructs such as:
 * - Line-leading escaped headings: `\### Heading` -> `### Heading`
 * - Line-leading escaped list bullets/numbers: `\* Item`, `\- Item`, `1\. Item` -> `* Item`, `- Item`, `1. Item`
 * - Paired escaped bold/italic/code delimiters: `\*\*Label:\*\*` -> `**Label:**`, `\*prima facie\*` -> `*prima facie*`
 *
 * Preserves legitimate non-Markdown backslashes (e.g., Windows paths like `C:\Users\docs`,
 * isolated backslashes, or escaped characters outside formatting syntax).
 */
export function normalizeEscapedMarkdown(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const lines = input.replace(/\r\n?/g, '\n').split('\n');

  const normalizedLines = lines.map((line) => {
    let out = line;

    // 1. Line-leading escaped ATX headings: `\### Summary` -> `### Summary`
    out = out.replace(/^(\s*)\\(#{1,6})(?=\s|$)/, '$1$2');

    // 2. Line-leading escaped unordered list markers: `\* Item`, `\- Item`, `\+ Item` -> `* Item`, `- Item`, `+ Item`
    out = out.replace(/^(\s*)\\([*+-])(?=\s+)/, '$1$2');

    // 3. Line-leading escaped ordered list markers: `1\. Item` -> `1. Item`
    out = out.replace(/^(\s*)(\d+)\\(\.\s+)/, '$1$2$3');

    // 4. Line-leading escaped blockquote marker: `\> Quote` -> `> Quote`
    out = out.replace(/^(\s*)\\(>\s?)/, '$1$2');

    // 5. Paired escaped bold markers (`\*\*...\*\*`, `\*\*...**`, `**\*\*`)
    // Only matches balanced inline spans where content starts/ends with non-whitespace
    out = out.replace(
      /(?<!\\)\\\*\\\*(\S(?:[^\n]*?\S)?)(?:\\\*\\\*|(?<!\\)\*\*)/g,
      '**$1**'
    );
    out = out.replace(
      /(?<!\\)\*\*(\S(?:[^\n]*?\S)?)\\\*\\\*/g,
      '**$1**'
    );
    out = out.replace(
      /(?<!\\)\\_\\_(\S(?:[^\n]*?\S)?)(?:\\_\\_|(?<!\\)__)/g,
      '__$1__'
    );
    out = out.replace(
      /(?<!\\)__(\S(?:[^\n]*?\S)?)\\_\\_/g,
      '__$1__'
    );

    // 6. Paired escaped italic markers (`\*prima facie\*`)
    // Requires non-whitespace right after opening and right before closing (CommonMark rule),
    // preventing corruption of math expressions or stray backslashes like `5 \* 3`.
    out = out.replace(
      /(?<!\*|\\)\\\*(?!\*)(\S(?:[^\n*]*?\S)?)\\\*(?!\*)/g,
      '*$1*'
    );
    out = out.replace(
      /(^|[\s(\["'])\\_(?!_)(\S(?:[^\n_]*?\S)?)\\_(?!_)(?=$|[\s).,;:!?"'\]])/g,
      '$1_$2_'
    );

    // 7. Paired escaped inline code markers (`` \`text\` ``)
    out = out.replace(/(?<!\\)\\`([^`\n]+?)\\`/g, '`$1`');

    return out;
  });

  return normalizedLines.join('\n');
}

/**
 * Parses inline Markdown formatting (`**bold**`, `*italic*`, `` `code` ``, `***bold italic***`)
 * into a safe AST without HTML injection.
 */
export function parseInlineMarkdown(text: string): InlineMarkdownNode[] {
  if (!text) return [];

  const nodes: InlineMarkdownNode[] = [];
  let i = 0;

  const pushText = (chunk: string) => {
    if (!chunk) return;
    const prev = nodes[nodes.length - 1];
    if (prev && prev.type === 'text') {
      prev.text += chunk;
    } else {
      nodes.push({ type: 'text', text: chunk });
    }
  };

  while (i < text.length) {
    // 1. Inline code: `...`
    if (text[i] === '`') {
      const closeIdx = text.indexOf('`', i + 1);
      if (closeIdx > i + 1) {
        nodes.push({ type: 'code', text: text.slice(i + 1, closeIdx) });
        i = closeIdx + 1;
        continue;
      }
    }

    // 2. Bold + Italic: ***...***
    if (text.startsWith('***', i)) {
      const closeIdx = findClosingDelimiter(text, '***', i + 3);
      if (closeIdx !== -1) {
        const inner = text.slice(i + 3, closeIdx);
        nodes.push({
          type: 'bold',
          children: [{ type: 'italic', children: parseInlineMarkdown(inner) }],
        });
        i = closeIdx + 3;
        continue;
      }
    }

    // 3. Bold: **...**
    if (text.startsWith('**', i)) {
      const closeIdx = findClosingDelimiter(text, '**', i + 2);
      if (closeIdx !== -1) {
        const inner = text.slice(i + 2, closeIdx);
        nodes.push({
          type: 'bold',
          children: parseInlineMarkdown(inner),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // 4. Bold with underscores: __...__ (strict word boundary so identifiers like zero_liability_prompt_report stay intact)
    if (text.startsWith('__', i) && !isAlphaNum(text[i - 1])) {
      const closeIdx = findClosingUnderscoreDelimiter(text, '__', i + 2);
      if (closeIdx !== -1) {
        const inner = text.slice(i + 2, closeIdx);
        nodes.push({
          type: 'bold',
          children: parseInlineMarkdown(inner),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // 5. Italic with asterisk: *...*
    if (text[i] === '*' && text[i + 1] !== '*') {
      const closeIdx = findClosingSingleAsterisk(text, i + 1);
      if (closeIdx !== -1) {
        const inner = text.slice(i + 1, closeIdx);
        nodes.push({
          type: 'italic',
          children: parseInlineMarkdown(inner),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // 6. Italic with underscore: _..._ (strict word boundary)
    if (text[i] === '_' && text[i + 1] !== '_' && !isAlphaNum(text[i - 1])) {
      const closeIdx = findClosingUnderscoreDelimiter(text, '_', i + 1);
      if (closeIdx !== -1) {
        const inner = text.slice(i + 1, closeIdx);
        nodes.push({
          type: 'italic',
          children: parseInlineMarkdown(inner),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    pushText(text[i]);
    i++;
  }

  return nodes;
}

function isAlphaNum(ch: string | undefined): boolean {
  return Boolean(ch && /[a-zA-Z0-9]/.test(ch));
}

function findClosingDelimiter(text: string, delim: string, startIdx: number): number {
  if (startIdx >= text.length || /\s/.test(text[startIdx])) {
    return -1;
  }
  let idx = startIdx;
  while (idx < text.length) {
    const found = text.indexOf(delim, idx);
    if (found === -1) return -1;
    if (found > startIdx && !/\s/.test(text[found - 1])) {
      return found;
    }
    idx = found + delim.length;
  }
  return -1;
}

function findClosingSingleAsterisk(text: string, startIdx: number): number {
  if (startIdx >= text.length || /\s/.test(text[startIdx])) {
    return -1;
  }
  let idx = startIdx;
  while (idx < text.length) {
    if (text.startsWith('**', idx)) {
      const boldClose = findClosingDelimiter(text, '**', idx + 2);
      if (boldClose !== -1) {
        idx = boldClose + 2;
        continue;
      }
    }
    if (text[idx] === '*' && text[idx + 1] !== '*') {
      if (idx > startIdx && !/\s/.test(text[idx - 1])) {
        return idx;
      }
    }
    idx++;
  }
  return -1;
}

function findClosingUnderscoreDelimiter(text: string, delim: string, startIdx: number): number {
  if (startIdx >= text.length || /\s/.test(text[startIdx])) {
    return -1;
  }
  let idx = startIdx;
  while (idx < text.length) {
    const found = text.indexOf(delim, idx);
    if (found === -1) return -1;
    const afterChar = text[found + delim.length];
    if (
      found > startIdx &&
      !/\s/.test(text[found - 1]) &&
      !isAlphaNum(afterChar) &&
      (delim.length > 1 || text[found + 1] !== '_')
    ) {
      return found;
    }
    idx = found + delim.length;
  }
  return -1;
}

/**
 * Parses normalized Markdown text into block-level AST nodes
 * (headings, unordered/ordered lists with optional nested sub-bullets, blockquotes, horizontal rules, and paragraphs).
 */
export function parseLegalMarkdownBlocks(rawText: string): LegalMarkdownBlock[] {
  const normalized = normalizeEscapedMarkdown(rawText);
  if (!normalized.trim()) {
    return [];
  }

  const lines = normalized.split('\n');
  const blocks: LegalMarkdownBlock[] = [];
  let i = 0;

  const isHeading = (line: string) => /^ {0,3}(#{1,6})\s+(.+?)\s*#*$/.test(line);
  const isUnorderedItem = (line: string) => /^(\s*)([-*+])\s+(.+)$/.test(line);
  const isOrderedItem = (line: string) => /^(\s*)(\d+)\.\s+(.+)$/.test(line);
  const isBlockquote = (line: string) => /^ {0,3}>\s?(.*)$/.test(line);
  const isHr = (line: string) => /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 1. Horizontal rule
    if (isHr(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 2. ATX Heading (# .. ######)
    const headingMatch = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        children: parseInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    // 3. Blockquote
    if (isBlockquote(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquote(lines[i])) {
        const m = lines[i].match(/^ {0,3}>\s?(.*)$/);
        if (m) quoteLines.push(m[1].trim());
        i++;
      }
      blocks.push({
        type: 'blockquote',
        children: parseInlineMarkdown(quoteLines.join(' ')),
      });
      continue;
    }

    // 4. Unordered or Ordered List
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch && !unorderedMatch);
      const baseIndent = (unorderedMatch ? unorderedMatch[1] : orderedMatch![1]).length;
      const items: LegalMarkdownListItem[] = [];

      while (i < lines.length) {
        const current = lines[i];
        if (!current.trim()) {
          // Peek ahead: if next non-empty line continues the same list type, stay in the list
          let nextNonEmpty = i + 1;
          while (nextNonEmpty < lines.length && !lines[nextNonEmpty].trim()) {
            nextNonEmpty++;
          }
          if (
            nextNonEmpty < lines.length &&
            (ordered ? isOrderedItem(lines[nextNonEmpty]) : isUnorderedItem(lines[nextNonEmpty]))
          ) {
            i = nextNonEmpty;
            continue;
          }
          break;
        }

        const ulM = current.match(/^(\s*)([-*+])\s+(.+)$/);
        const olM = current.match(/^(\s*)(\d+)\.\s+(.+)$/);

        if (ulM && (!ordered || ulM[1].length > baseIndent)) {
          const indent = ulM[1].length;
          if (indent > baseIndent && items.length > 0) {
            const parent = items[items.length - 1];
            parent.subItems = parent.subItems || [];
            parent.subItems.push({ children: parseInlineMarkdown(ulM[3].trim()) });
          } else {
            items.push({ children: parseInlineMarkdown(ulM[3].trim()) });
          }
          i++;
          continue;
        }

        if (olM && (ordered || olM[1].length > baseIndent)) {
          const indent = olM[1].length;
          if (indent > baseIndent && items.length > 0) {
            const parent = items[items.length - 1];
            parent.subItems = parent.subItems || [];
            parent.subItems.push({ children: parseInlineMarkdown(olM[3].trim()) });
          } else {
            items.push({ children: parseInlineMarkdown(olM[3].trim()) });
          }
          i++;
          continue;
        }

        break;
      }

      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // 5. Paragraph (collect contiguous non-block lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isUnorderedItem(lines[i]) &&
      !isOrderedItem(lines[i]) &&
      !isBlockquote(lines[i]) &&
      !isHr(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        children: parseInlineMarkdown(paraLines.join(' ')),
      });
    }
  }

  return blocks;
}
