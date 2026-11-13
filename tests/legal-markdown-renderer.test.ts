/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  normalizeEscapedMarkdown,
  parseInlineMarkdown,
  parseLegalMarkdownBlocks,
} from '../src/utils/legalMarkdown';
import { LegalMarkdownRenderer } from '../src/components/LegalMarkdownRenderer';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

runTest('normalizeEscapedMarkdown unescapes Markdown syntax constructs without mutating legal text', () => {
  const escaped = [
    '\\### Summary of Statutory Findings',
    '',
    '\\*\\*Applicable Law:\\*\\* Based on the disputed transaction of ₹42,500 on 14 Feb 2026, Section 318(4) BNS 2023 and Section 66D IT Act apply \\*prima facie\\*.',
    '',
    '\\* \\*\\*Primary Statutory Offence:\\*\\* Dishonest inducement and impersonation under \\*\\*Section 318(4) BNS\\*\\*.',
    '  \\* Sub-point with \\`zero_liability_prompt_report\\` classification.',
    '\\- \\*\\*Regulatory Protection:\\*\\* Zero customer liability may apply if reported within 3 working days.',
    '1\\. Preserve bank SMS alerts and UTR references.',
    '\\> Final cognizance rests with the magistrate or RBI Ombudsman.',
  ].join('\n');

  const normalized = normalizeEscapedMarkdown(escaped);

  assert.equal(normalized.includes('\\###'), false);
  assert.equal(normalized.includes('\\*\\*'), false);
  assert.equal(normalized.includes('\\*prima'), false);
  assert.equal(normalized.includes('1\\.'), false);
  assert.equal(normalized.includes('\\>'), false);

  assert.ok(normalized.includes('### Summary of Statutory Findings'));
  assert.ok(normalized.includes('**Applicable Law:**'));
  assert.ok(normalized.includes('*prima facie*'));
  assert.ok(normalized.includes('* **Primary Statutory Offence:**'));
  assert.ok(normalized.includes('  * Sub-point with `zero_liability_prompt_report` classification.'));
  assert.ok(normalized.includes('- **Regulatory Protection:**'));
  assert.ok(normalized.includes('1. Preserve bank SMS alerts and UTR references.'));
  assert.ok(normalized.includes('> Final cognizance rests with the magistrate or RBI Ombudsman.'));
  // Legal details untouched
  assert.ok(normalized.includes('₹42,500'));
  assert.ok(normalized.includes('14 Feb 2026'));
  assert.ok(normalized.includes('Section 318(4) BNS 2023'));
  assert.ok(normalized.includes('Section 66D IT Act'));
});

runTest('normalizeEscapedMarkdown preserves legitimate non-Markdown backslashes and identifiers', () => {
  const input = [
    'Evidence path: C:\\Users\\citizen\\evidence.pdf',
    'Formula check: 5 \\* 3 = 15 (not italic) and lone backslash \\ stays intact.',
    'RBI classification key: zero_liability_prompt_report and BNS_318_4.',
  ].join('\n');

  const normalized = normalizeEscapedMarkdown(input);
  assert.equal(normalized, input);
});

runTest('parseInlineMarkdown handles bold, italic, bold-italic, inline code, and snake_case', () => {
  const nodes = parseInlineMarkdown(
    '**Applicable Law:** *prima facie* under ***Section 318(4)*** with `BNS_318_4` and zero_liability_prompt_report.'
  );

  assert.equal(nodes[0]?.type, 'bold');
  assert.ok(nodes.some((n) => n.type === 'italic'));
  assert.ok(nodes.some((n) => n.type === 'code' && n.text === 'BNS_318_4'));

  const html = renderToStaticMarkup(
    React.createElement(LegalMarkdownRenderer, {
      content:
        '**Applicable Law:** *prima facie* under ***Section 318(4)*** with `BNS_318_4` and zero_liability_prompt_report.',
    })
  );

  assert.ok(html.includes('<strong'));
  assert.ok(html.includes('Applicable Law:</strong>'));
  assert.ok(html.includes('<em'));
  assert.ok(html.includes('prima facie</em>'));
  assert.ok(html.includes('Section 318(4)</em></strong>'));
  assert.ok(html.includes('<code'));
  assert.ok(html.includes('BNS_318_4</code>'));
  // Snake_case identifier must NOT be italicized
  assert.ok(html.includes('zero_liability_prompt_report'));
  assert.equal(html.includes('<em>liability</em>'), false);
});

runTest('parseLegalMarkdownBlocks parses headings, nested lists, ordered lists, blockquotes, and hr', () => {
  const md = [
    '\\# Statutory Synthesis',
    '\\### Summary of Statutory Findings',
    'Paragraph text explaining uncertainty: exact liability depends on bank investigation.',
    '\\* First bullet',
    '  \\* Nested bullet',
    '\\* Second bullet',
    '---',
    '1\\. Step one',
    '2\\. Step two',
    '\\> Statutory note under BNSS Section 173.',
  ].join('\n');

  const blocks = parseLegalMarkdownBlocks(md);
  assert.equal(blocks[0]?.type, 'heading');
  assert.equal(blocks[0]?.type === 'heading' && blocks[0].level, 1);
  assert.equal(blocks[1]?.type, 'heading');
  assert.equal(blocks[1]?.type === 'heading' && blocks[1].level, 3);
  assert.equal(blocks[2]?.type, 'paragraph');
  assert.equal(blocks[3]?.type, 'list');
  if (blocks[3]?.type === 'list') {
    assert.equal(blocks[3].ordered, false);
    assert.equal(blocks[3].items.length, 2);
    assert.equal(blocks[3].items[0].subItems?.length, 1);
  }
  assert.equal(blocks[4]?.type, 'hr');
  assert.equal(blocks[5]?.type, 'list');
  if (blocks[5]?.type === 'list') {
    assert.equal(blocks[5].ordered, true);
    assert.equal(blocks[5].items.length, 2);
  }
  assert.equal(blocks[6]?.type, 'blockquote');
});

runTest('LegalMarkdownRenderer renders realistic escaped Gemini Legal Analysis cleanly in default and compact variants', () => {
  const realisticEscapedSynthesis = [
    '\\### Summary of Statutory Findings',
    '',
    'Based on the reported incident of ₹48,900 on 03 Mar 2026 involving **HDFC Bank**, the facts indicate a \\*prima facie\\* cyber-enabled financial fraud.',
    '',
    '\\* \\*\\*Applicable Law:\\*\\* Section 318(4) of BNS 2023 and Section 66D of the IT Act, 2000.',
    '\\* \\*\\*RBI Customer Protection:\\*\\* Eligible for zero-liability review subject to bank verification of prompt reporting within 3 working days.',
    '\\* \\*\\*Uncertainty Notice:\\*\\* Final criminal cognizance remains subject to police FIR registration and forensic verification.',
  ].join('\n');

  const defaultHtml = renderToStaticMarkup(
    React.createElement(LegalMarkdownRenderer, {
      content: realisticEscapedSynthesis,
      variant: 'default',
    })
  );

  assert.ok(defaultHtml.includes('<h5'));
  assert.ok(defaultHtml.includes('Summary of Statutory Findings</h5>'));
  assert.ok(defaultHtml.includes('<strong'));
  assert.ok(defaultHtml.includes('Applicable Law:</strong>'));
  assert.ok(defaultHtml.includes('<em class="italic">prima facie</em>'));
  assert.ok(defaultHtml.includes('<ul class="list-disc'));
  assert.ok(defaultHtml.includes('<li'));
  // No leaked raw markdown or escape markers
  assert.equal(defaultHtml.includes('\\###'), false);
  assert.equal(defaultHtml.includes('\\*'), false);
  assert.equal(defaultHtml.includes('**Applicable Law:**'), false);
  assert.equal(defaultHtml.includes('*prima facie*'), false);
  // Preserved legal details
  assert.ok(defaultHtml.includes('₹48,900'));
  assert.ok(defaultHtml.includes('03 Mar 2026'));
  assert.ok(defaultHtml.includes('Section 318(4) of BNS 2023'));
  assert.ok(defaultHtml.includes('Section 66D of the IT Act, 2000'));
  assert.ok(defaultHtml.includes('Final criminal cognizance remains subject to police FIR registration'));

  const compactHtml = renderToStaticMarkup(
    React.createElement(LegalMarkdownRenderer, {
      content: realisticEscapedSynthesis,
      variant: 'compact',
    })
  );
  assert.ok(compactHtml.includes('text-[11px]'));
  assert.ok(compactHtml.includes('<h5'));
  assert.ok(compactHtml.includes('<ul'));
});

runTest('LegalMarkdownRenderer renders standard unescaped deterministic summary and handles empty input', () => {
  const deterministicSummary = [
    '# Preliminary Statutory Assessment (Citizen Guidance)',
    '',
    '### 1. Applicable Criminal Provisions (BNS / IPC)',
    '* **BNS Section 318(4)**: Cheating and dishonestly inducing delivery of property.',
    '',
    '### 2. RBI Customer Protection',
    '* **Zero Liability:** Prompt reporting within 3 working days.',
  ].join('\n');

  const html = renderToStaticMarkup(
    React.createElement(LegalMarkdownRenderer, { content: deterministicSummary })
  );

  assert.ok(html.includes('<h4'));
  assert.ok(html.includes('Preliminary Statutory Assessment (Citizen Guidance)</h4>'));
  assert.ok(html.includes('<h5'));
  assert.ok(html.includes('1. Applicable Criminal Provisions (BNS / IPC)</h5>'));
  assert.ok(html.includes('BNS Section 318(4)</strong>'));

  const emptyHtml = renderToStaticMarkup(
    React.createElement(LegalMarkdownRenderer, { content: '   \n  ' })
  );
  assert.equal(emptyHtml, '');
});
